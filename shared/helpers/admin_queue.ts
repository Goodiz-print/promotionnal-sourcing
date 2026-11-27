import type { QueueJobStatus, QueueJobTimes } from '../types/admin_queue.js'

/**
 * Horodatage affiché pour un job : fin pour un job terminé (succès ou échec),
 * prise en charge pour un job actif, échéance sinon.
 */
export function queueJobDisplayedTime(
  status: QueueJobStatus,
  times: QueueJobTimes
): string | number | null {
  if (status === 'completed' || status === 'failed') return times.finishedAt
  if (status === 'active') return times.acquiredAt
  return times.dueAt
}
