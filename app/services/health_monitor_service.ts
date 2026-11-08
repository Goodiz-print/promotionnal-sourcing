import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import healthConfig from '#config/health'
import PlatformHealthAlert from '#mails/platform_health_alert'
import HealthProbeService from '#services/health_probe_service'
import {
  HEALTH_COMPONENTS,
  HEALTH_EXTERNAL_COMPONENTS,
  HEALTH_SEVERITY,
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
  async summary(): Promise<PlatformHealthSummary> {
    const rows: HealthComponentStateDbRow[] = await db
      .from('health_component_states')
      .select(...STATE_COLUMNS)
    const order = (component: HealthComponent) => HEALTH_COMPONENTS.indexOf(component)
    const components = rows.map(toState).sort((a, b) => order(a.component) - order(b.component))
    return {
      status: this.probes.worst(components),
      components,
      checkedAt: components.reduce<string | null>(
        (latest, state) => (latest === null || state.checkedAt > latest ? state.checkedAt : latest),
        null
      ),
    }
  }

  /** Une passe : sonde, met à jour les états, alerte. Renvoie le rapport sondé. */
  async check(now: Date = new Date()): Promise<PlatformHealthReport> {
    const report = await this.probes.report(now)
    const previous = await this.states()
    const events: HealthAlertEvent[] = []

    for (const current of report.components) {
      const prior = previous.get(current.component)
      const event = await this.apply(current, prior, now)
      if (event) events.push(event)
    }

    if (events.length > 0) await this.notify(events)
    return report
  }

  private async states() {
    const rows: HealthComponentStateDbRow[] = await db
      .from('health_component_states')
      .select(...STATE_COLUMNS)
    return new Map(rows.map((row) => [row.component, toState(row)]))
  }

  /** Met à jour l'état d'un composant ; renvoie l'événement à notifier, le cas échéant. */
  private async apply(
    current: HealthComponentReport,
    prior: HealthComponentState | undefined,
    now: Date
  ): Promise<HealthAlertEvent | null> {
    const failing = unhealthy(current.status)
    const consecutiveFailures = failing ? (prior?.consecutiveFailures ?? 0) + 1 : 0
    const changed = prior?.status !== current.status
    const alertable = !HEALTH_EXTERNAL_COMPONENTS.includes(current.component)

    let event: HealthAlertEvent | null = null
    let alerted = prior?.alerted ?? false

    if (failing && alertable) {
      const worsened =
        prior !== undefined && HEALTH_SEVERITY[current.status] > HEALTH_SEVERITY[prior.status]
      if (consecutiveFailures >= healthConfig.alertAfterFailures && (!alerted || worsened)) {
        event = {
          component: current.component,
          status: current.status,
          previous: prior?.status ?? 'ok',
          detail: current.detail,
        }
        alerted = true
      }
    } else if (!failing && alerted) {
      event = {
        component: current.component,
        status: current.status,
        previous: prior?.status ?? 'ok',
        detail: current.detail,
      }
      alerted = false
    }

    await db
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

    return event
  }

  /**
   * Log `error` structuré (repris par Sentry dès qu'il est branché, #79), puis mail à
   * `MAIL_ALERT_ADDRESS`. Le mail part en direct, pas par la queue : une queue à
   * l'arrêt est justement ce qu'il faut signaler. Une erreur d'envoi est loguée,
   * jamais propagée : le prochain passage recalculera l'état, mais l'événement est
   * perdu — on le journalise donc en entier.
   */
  private async notify(events: HealthAlertEvent[]) {
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
    if (!address) return
    try {
      await mail.send(new PlatformHealthAlert(address, events))
    } catch (error) {
      logger.error({ err: error }, 'platform health alert not sent')
    }
  }
}
