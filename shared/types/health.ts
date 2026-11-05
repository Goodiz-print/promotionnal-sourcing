/**
 * Seuils de supervision de la queue (#61). Au-delà, le worker est considéré
 * comme absent ou bloqué.
 */
export const QUEUE_THRESHOLDS = {
  /** Job `pending` / `delayed` dont l'échéance est dépassée depuis plus de 15 min. */
  pendingOverdueMs: 15 * 60_000,
  /** Job `active` acquis depuis plus de 30 min : worker figé ou tué en plein travail. */
  activeStuckMs: 30 * 60_000,
  /** Fenêtre des échecs remontés dans le rapport. */
  failedWindowMs: 24 * 60 * 60_000,
} as const

/**
 * Rapport de santé de la queue, produit par `HealthService.queueReport`.
 * `ok` ne dépend que du backlog et des jobs bloqués ; les échecs sont informatifs.
 * Déclaré en `type` : le rapport est une prop Inertia (tableau de bord, supervision
 * de la queue), qu'une `interface` ne satisferait pas.
 */
export type QueueHealthReport = {
  ok: boolean
  pendingOverdue: number
  oldestPendingAgeMs: number | null
  stuckActive: number
  failedLast24h: number
  checkedAt: string
}
