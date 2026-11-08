import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import mail from '@adonisjs/mail/services/main'
import healthConfig from '#config/health'
import PlatformHealthAlert from '#mails/platform_health_alert'
import HealthProbeService from '#services/health_probe_service'
import {
  HEALTH_COMPONENTS,
  HEALTH_EXTERNAL_COMPONENTS,
  HEALTH_SEVERITY,
  HEALTH_STALE_AFTER_MINUTES,
  type HealthAlertEvent,
  type HealthComponent,
  type HealthComponentReport,
  type HealthComponentState,
  type HealthComponentStateDbRow,
  type PlatformHealthReport,
  type PlatformHealthSummary,
} from '#shared/types/admin_health'

const STATE_COLUMNS = [
  'component',
  'status',
  'consecutive_failures',
  'since',
  'checked_at',
  'detail',
  'alerted',
] as const

/** Clé de l'advisory lock Postgres qui sérialise les passes de surveillance. */
const CHECK_LOCK_KEY = 1790179

type Queryable = typeof db | TransactionClientContract

/** Événement à notifier, avec la valeur finale de `alerted` une fois l'alerte livrée. */
type PendingAlert = { event: HealthAlertEvent; alerted: boolean }

const iso = (value: Date | string) => new Date(value).toISOString()
const unhealthy = (status: HealthComponentReport['status']) => HEALTH_SEVERITY[status] > 0

function toState(row: HealthComponentStateDbRow): HealthComponentState {
  return {
    component: row.component,
    status: row.status,
    consecutiveFailures: row.consecutive_failures,
    since: iso(row.since),
    checkedAt: iso(row.checked_at),
    detail: row.detail,
    alerted: row.alerted,
  }
}

/**
 * Surveillance de la plateforme (#179). Chaque passe sonde les composants, conserve
 * leur état dans `health_component_states` et alerte quand un composant reste
 * dégradé ou en panne `alertAfterFailures` passes de suite (un raté isolé ne
 * réveille personne), puis une dernière fois quand il se rétablit. Une alerte par
 * incident, pas une par passe : l'état `alerted` l'empêche de se répéter, sauf si
 * l'incident s'aggrave (`degraded` → `down`).
 *
 * Accès à la base par `db` uniquement : pas de modèle Lucid propre. Mais la
 * dépendance `HealthProbeService` en importe un : ce service est résolu dans
 * `execute()` du job, jamais importé par un module de job.
 */
@inject()
export default class HealthMonitorService {
  constructor(private probes: HealthProbeService) {}

  /** Dernier état connu de chaque composant, sans sonder : pour le tableau de bord. */
  async summary(now: Date = new Date()): Promise<PlatformHealthSummary> {
    const stored = await this.states()
    const states = [...stored.values()]
    const order = (component: HealthComponent) => HEALTH_COMPONENTS.indexOf(component)
    const components = states.sort((a, b) => order(a.component) - order(b.component))
    const checkedAt = components.reduce<string | null>(
      (latest, state) => (latest === null || state.checkedAt > latest ? state.checkedAt : latest),
      null
    )
    const limit = now.getTime() - HEALTH_STALE_AFTER_MINUTES * 60_000
    return {
      status: this.probes.worst(components),
      components,
      checkedAt,
      stale: checkedAt !== null && new Date(checkedAt).getTime() < limit,
    }
  }

  /**
   * Une passe : sonde, met à jour les états, alerte. Renvoie le rapport sondé, ou
   * `null` si une autre passe est en cours (deux workers, lancement manuel) : elle
   * s'en charge, et deux passes simultanées enverraient l'alerte en double.
   */
  async check(now: Date = new Date()): Promise<PlatformHealthReport | null> {
    const outcome = await db.transaction(async (trx) => {
      const lock = await trx.rawQuery('select pg_try_advisory_xact_lock(?) as locked', [
        CHECK_LOCK_KEY,
      ])
      if (!lock.rows[0]?.locked) return null

      const report = await this.probes.report(now)
      const previous = await this.states(trx)
      const pending: PendingAlert[] = []
      for (const current of report.components) {
        const alert = await this.apply(trx, current, previous.get(current.component), now)
        if (alert) pending.push(alert)
      }
      return { report, pending }
    })
    if (!outcome) return null

    // Hors transaction : un SMTP lent ne doit pas retenir le verrou ni une connexion.
    if (outcome.pending.length > 0) await this.deliver(outcome.pending)
    return outcome.report
  }

  private async states(client: Queryable = db) {
    const rows: HealthComponentStateDbRow[] = await client
      .from('health_component_states')
      .select(...STATE_COLUMNS)
    return new Map(rows.map((row) => [row.component, toState(row)]))
  }

  /**
   * Met à jour l'état d'un composant ; renvoie l'alerte à livrer, le cas échéant.
   * Tant qu'une alerte n'est pas livrée, `alerted` garde la valeur qui la fera
   * rejouer à la passe suivante (faux pour un incident, vrai pour un rétablissement) :
   * un mail en échec n'est pas perdu.
   */
  private async apply(
    client: Queryable,
    current: HealthComponentReport,
    prior: HealthComponentState | undefined,
    now: Date
  ): Promise<PendingAlert | null> {
    const failing = unhealthy(current.status)
    const consecutiveFailures = failing ? (prior?.consecutiveFailures ?? 0) + 1 : 0
    const changed = prior?.status !== current.status
    const alertable = !HEALTH_EXTERNAL_COMPONENTS.includes(current.component)

    let pending: PendingAlert | null = null
    let alerted = prior?.alerted ?? false

    if (failing && alertable) {
      const worsened =
        prior !== undefined && HEALTH_SEVERITY[current.status] > HEALTH_SEVERITY[prior.status]
      if (consecutiveFailures >= healthConfig.alertAfterFailures && (!alerted || worsened)) {
        pending = { event: this.eventOf(current, prior), alerted: true }
        alerted = false
      }
    } else if (!failing && alerted) {
      pending = { event: this.eventOf(current, prior), alerted: false }
    }

    await client
      .table('health_component_states')
      .insert({
        component: current.component,
        status: current.status,
        consecutive_failures: consecutiveFailures,
        since: changed || !prior ? now : prior.since,
        checked_at: now,
        detail: current.detail,
        alerted,
      })
      .onConflict('component')
      .merge()

    return pending
  }

  private eventOf(
    current: HealthComponentReport,
    prior: HealthComponentState | undefined
  ): HealthAlertEvent {
    return {
      component: current.component,
      status: current.status,
      previous: prior?.status ?? 'ok',
      detail: current.detail,
    }
  }

  /** Notifie, puis seulement alors acte `alerted` : un envoi raté sera rejoué. */
  private async deliver(pending: PendingAlert[]) {
    if (!(await this.notify(pending.map(({ event }) => event)))) return
    for (const { event, alerted } of pending) {
      await db
        .from('health_component_states')
        .where('component', event.component)
        .update({ alerted })
    }
  }

  /**
   * Log `error` structuré (repris par Sentry dès qu'il est branché, #79), puis mail à
   * `MAIL_ALERT_ADDRESS`. Le mail part en direct, pas par la queue : une queue à
   * l'arrêt est justement ce qu'il faut signaler. Renvoie `false` si le mail n'a pas
   * pu partir : l'alerte reste alors due et sera rejouée à la passe suivante. Sans
   * adresse configurée, le log est le seul canal et suffit.
   */
  private async notify(events: HealthAlertEvent[]): Promise<boolean> {
    for (const event of events) {
      logger.error(
        {
          component: event.component,
          status: event.status,
          previous: event.previous,
          detail: event.detail,
        },
        'platform health changed'
      )
    }

    const address = healthConfig.alertAddress
    if (!address) return true
    try {
      await mail.send(new PlatformHealthAlert(address, events))
      return true
    } catch (error) {
      logger.error({ err: error }, 'platform health alert not sent')
      return false
    }
  }
}
