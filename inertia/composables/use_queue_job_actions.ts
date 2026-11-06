import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import type { AdminQueueJobRow } from '#shared/types/admin_queue'

/**
 * Relance / annulation d'un job de queue depuis le back-office (#175) : demande
 * une confirmation puis poste la visite Inertia. Partagé par la liste et la fiche.
 */
export function useQueueJobActions() {
  const { t, locale } = useI18n()

  function act(
    job: Pick<AdminQueueJobRow, 'id' | 'queue' | 'name'>,
    name: 'retry' | 'cancel',
    options: { preserveScroll?: boolean } = {}
  ) {
    if (!window.confirm(t(`admin.queue.actions.${name}Confirm`, { name: job.name }))) return
    router.post(
      urlFor(`admin.queue.${name}`, { locale: locale.value, queue: job.queue, id: job.id }),
      {},
      options
    )
  }

  return { act }
}
