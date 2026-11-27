import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import Anthropic from '@anthropic-ai/sdk'
import aiConfig from '#config/ai'
import healthConfig from '#config/health'
import HealthService from '#services/health_service'
import SearchEngine from '#services/search/search_engine'
import StorageService from '#services/storage/storage_service'
import {
  HEALTH_COMPONENTS,
  HEALTH_DETAIL_MAX_LENGTH,
  HEALTH_EXTERNAL_COMPONENTS,
  HEALTH_MAIL_WINDOW_MINUTES,
  HEALTH_SOFT_COMPONENTS,
  HEALTH_SEVERITY,
  type HealthComponent,
  type HealthComponentReport,
  type HealthStatus,
  type PlatformHealthReport,
} from '#shared/types/admin_health'

/** Résultat brut d'une sonde, avant mesure de la durée. */
type Outcome = { status: HealthStatus; detail?: string | null }

const VIES_STATUS_URL = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-status'
const MISTRAL_MODELS_URL = 'https://api.mistral.ai/v1/models'

const messageOf = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, HEALTH_DETAIL_MAX_LENGTH)

/** Rejette si `promise` ne répond pas à temps : un service muet ne doit rien figer. */
async function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer within ${ms} ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Sondes de la plateforme (#179) : base, queue, recherche, Cellar, mails, VIES,
 * Mistral et Claude. Chaque sonde est isolée : une exception devient le statut `down` de son
 * composant et ne remonte jamais, de sorte qu'un composant en panne ne casse ni le
 * rapport ni la sonde de liveness (`/health`, qui ne dépend que de la base).
 *
 * Importe `StorageService` (donc un modèle Lucid) : ce service n'est jamais importé
 * par un module de job, qui le résout dans `execute()`.
 */
@inject()
export default class HealthProbeService {
  constructor(
    private health: HealthService,
    private engine: SearchEngine,
    private storage: StorageService,
    private claudeClient: Anthropic
  ) {}

  /** Sonde tous les composants en parallèle. */
  async report(now: Date = new Date()): Promise<PlatformHealthReport> {
    const components = await Promise.all(HEALTH_COMPONENTS.map((name) => this.probe(name)))
    return {
      status: this.worst(components),
      components,
      checkedAt: now.toISOString(),
    }
  }

  /** Pire statut parmi les composants sondés ; `disabled` ne compte pas. */
  worst(components: Pick<HealthComponentReport, 'status'>[]): 'ok' | 'degraded' | 'down' {
    let worst: 'ok' | 'degraded' | 'down' = 'ok'
    for (const { status } of components) {
      if (status === 'disabled') continue
      if (HEALTH_SEVERITY[status] > HEALTH_SEVERITY[worst]) worst = status
    }
    return worst
  }

  private async probe(component: HealthComponent): Promise<HealthComponentReport> {
    const startedAt = Date.now()
    let outcome: Outcome
    try {
      outcome = await within(this.run(component), healthConfig.probeTimeoutMs)
    } catch (error) {
      // Un tiers injoignable (réseau, délai) n'est pas prouvé tombé : `degraded` seulement.
      const soft = HEALTH_SOFT_COMPONENTS.includes(component)
      outcome = { status: soft ? 'degraded' : 'down', detail: messageOf(error) }
    }
    const latencyMs = outcome.status === 'disabled' ? null : Date.now() - startedAt

    let status = outcome.status
    let detail = outcome.detail ?? null
    // Un service qui répond, mais trop lentement, est dégradé (pas en panne).
    if (status === 'ok' && latencyMs !== null && latencyMs > healthConfig.slowMs) {
      status = 'degraded'
      detail = `${latencyMs} ms > ${healthConfig.slowMs} ms`
    }
    // Un tiers hors de notre contrôle ne dépasse jamais « dégradé ».
    if (status === 'down' && HEALTH_EXTERNAL_COMPONENTS.includes(component)) status = 'degraded'

    return { component, status, latencyMs, detail }
  }

  private run(component: HealthComponent): Promise<Outcome> {
    switch (component) {
      case 'database':
        return this.database()
      case 'queue':
        return this.queue()
      case 'search':
        return this.search()
      case 'storage':
        return this.cellar()
      case 'mail':
        return this.mail()
      case 'vies':
        return this.vies()
      case 'mistral':
        return this.mistral()
      case 'claude':
        return this.claude()
    }
  }

  private async database(): Promise<Outcome> {
    return (await this.health.databaseReachable())
      ? { status: 'ok' }
      : { status: 'down', detail: 'select 1 failed' }
  }

  /** En retard = personne ne consomme (`down`) ; seuls des jobs figés = `degraded`. */
  private async queue(): Promise<Outcome> {
    const report = await this.health.queueReport()
    if (report.pendingOverdue > 0) {
      return { status: 'down', detail: `${report.pendingOverdue} job(s) overdue` }
    }
    if (report.stuckActive > 0) {
      return { status: 'degraded', detail: `${report.stuckActive} job(s) stuck` }
    }
    return { status: 'ok' }
  }

  private async search(): Promise<Outcome> {
    if (!this.engine.enabled) return { status: 'disabled' }
    await this.engine.inspect()
    return { status: 'ok' }
  }

  private async cellar(): Promise<Outcome> {
    await this.storage.ping()
    return { status: 'ok' }
  }

  /**
   * Santé du circuit d'envoi, déduite du journal plutôt que d'une connexion SMTP :
   * un serveur qui répond mais refuse les mails se voit ici, pas à la connexion.
   */
  private async mail(): Promise<Outcome> {
    const row = await db
      .from('mail_deliveries')
      .where('status', 'failed')
      .where('updated_at', '>=', new Date(Date.now() - HEALTH_MAIL_WINDOW_MINUTES * 60_000))
      .count('* as total')
      .first()
    const failed = Number(row?.total ?? 0)
    if (failed >= healthConfig.mailFailedThreshold) {
      return {
        status: 'degraded',
        detail: `${failed} failed in ${HEALTH_MAIL_WINDOW_MINUTES} min (threshold ${healthConfig.mailFailedThreshold})`,
      }
    }
    return { status: 'ok', detail: failed > 0 ? `${failed} failed` : null }
  }

  private async vies(): Promise<Outcome> {
    const response = await fetch(VIES_STATUS_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(healthConfig.probeTimeoutMs),
    })
    return response.ok
      ? { status: 'ok' }
      : { status: 'degraded', detail: `HTTP ${response.status}` }
  }

  /** Liste des modèles : authentifié, gratuit, et ne consomme aucun token. */
  private async mistral(): Promise<Outcome> {
    const apiKey = aiConfig.mistral.apiKey
    if (!apiKey) return { status: 'disabled' }
    const response = await fetch(MISTRAL_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(healthConfig.probeTimeoutMs),
    })
    if (response.ok) return { status: 'ok' }
    // 401/403 : clé refusée, rien ne marchera tant qu'elle n'est pas corrigée.
    const rejected = response.status === 401 || response.status === 403
    return { status: rejected ? 'down' : 'degraded', detail: `HTTP ${response.status}` }
  }

  /**
   * Liste des modèles (API Anthropic) : authentifié, gratuit, aucun token consommé.
   * Sa clé présente, Claude est le fournisseur actif (`resolveLlmProvider`) : la
   * sonde ne porte donc jamais sur un fournisseur inutilisé.
   */
  private async claude(): Promise<Outcome> {
    if (!aiConfig.claude.apiKey) return { status: 'disabled' }
    try {
      await this.claudeClient.models.list(
        { limit: 1 },
        { timeout: healthConfig.probeTimeoutMs, maxRetries: 0 }
      )
      return { status: 'ok' }
    } catch (error) {
      // Sans statut HTTP (réseau, délai) : injoignable, traité par `probe()`.
      if (!(error instanceof Anthropic.APIError) || error.status === undefined) throw error
      // 401/403 : clé refusée, rien ne marchera tant qu'elle n'est pas corrigée.
      const rejected = error.status === 401 || error.status === 403
      return { status: rejected ? 'down' : 'degraded', detail: `HTTP ${error.status}` }
    }
  }
}
