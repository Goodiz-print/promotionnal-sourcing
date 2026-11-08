/**
 * Santé de la plateforme (#179) : composants sondés, statuts et rapports.
 * Déclarés en `type` : les rapports sont des props Inertia, qu'une `interface`
 * ne satisferait pas.
 */

/** Composants sondés, dans l'ordre d'affichage. */
export const HEALTH_COMPONENTS = [
  'database',
  'queue',
  'search',
  'storage',
  'mail',
  'vies',
  'mistral',
] as const

export type HealthComponent = (typeof HEALTH_COMPONENTS)[number]

/**
 * `ok` : répond normalement. `degraded` : répond mal (lent, en retard, erreurs).
 * `down` : injoignable. `disabled` : non configuré, donc non sondé (jamais une alerte).
 */
export const HEALTH_STATUSES = ['ok', 'degraded', 'down', 'disabled'] as const

export type HealthStatus = (typeof HEALTH_STATUSES)[number]

/**
 * Services tiers hors de notre contrôle : VIES tombe souvent (il dépend des
 * administrations nationales) et ne passe jamais plus bas que `degraded`. Les
 * autres composants sont alertants.
 */
export const HEALTH_EXTERNAL_COMPONENTS: readonly HealthComponent[] = ['vies']

/** Gravité d'un statut, pour comparer et retenir le pire. */
export const HEALTH_SEVERITY: Record<HealthStatus, number> = {
  disabled: 0,
  ok: 0,
  degraded: 1,
  down: 2,
}

/** Fenêtre de comptage des échecs d'envoi de mails. */
export const HEALTH_MAIL_WINDOW_MINUTES = 60

/** Longueur maximale du détail d'un composant (un message d'erreur peut être long). */
export const HEALTH_DETAIL_MAX_LENGTH = 300

export type HealthComponentReport = {
  component: HealthComponent
  status: HealthStatus
  /** Durée de la sonde en ms ; `null` si elle n'a pas été faite (`disabled`). */
  latencyMs: number | null
  /** Explication courte (chiffres, message d'erreur) ; `null` si rien à dire. */
  detail: string | null
}

export type PlatformHealthReport = {
  /** Pire statut des composants sondés (`disabled` ignoré). */
  status: Exclude<HealthStatus, 'disabled'>
  components: HealthComponentReport[]
  checkedAt: string
}

/** État conservé par composant entre deux passes du job de surveillance. */
export type HealthComponentState = {
  component: HealthComponent
  status: HealthStatus
  /** Passes consécutives hors `ok`. */
  consecutiveFailures: number
  /** Depuis quand le composant a ce statut. */
  since: string
  checkedAt: string
  detail: string | null
  /** Vrai si une alerte a été envoyée pour l'incident en cours. */
  alerted: boolean
}

/** Ligne brute de `health_component_states`. */
export type HealthComponentStateDbRow = {
  component: HealthComponent
  status: HealthStatus
  consecutive_failures: number
  since: Date | string
  checked_at: Date | string
  detail: string | null
  alerted: boolean
}

/** Changement notifié dans l'alerte : un incident qui s'ouvre, s'aggrave ou se ferme. */
export type HealthAlertEvent = {
  component: HealthComponent
  status: HealthStatus
  previous: HealthStatus
  detail: string | null
}

/** Ce que voit le tableau de bord : les derniers états connus, sans sonder. */
export type PlatformHealthSummary = {
  status: Exclude<HealthStatus, 'disabled'>
  components: HealthComponentState[]
  /** `null` tant que le job de surveillance n'a jamais tourné. */
  checkedAt: string | null
}
