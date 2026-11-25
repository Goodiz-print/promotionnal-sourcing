import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { useConfirm } from '~/composables/use_confirm'
import type { ConfirmTone } from '~/types/ui'
import type { AdminQueueJobRow } from '#shared/types/admin_queue'

/** Bouton et ton de la confirmation : l'annulation supprime le job de la file. */
const JOB_ACTION_CONFIRM: Record<'retry' | 'cancel', { confirmLabel: string; tone: ConfirmTone }> =
  {
    retry: { confirmLabel: 'admin.queue.actions.retry', tone: 'default' },
    cancel: { confirmLabel: 'admin.queue.actions.cancelJob', tone: 'danger' },
  }

/**
 * Relance / annulation d'un job de queue depuis le back-office (#175) : demande
 * une confirmation puis poste la visite Inertia. Partagé par la liste et la fiche.
 */
export function useQueueJobActions() {
  const { t, locale } = useI18n()
  const { confirm } = useConfirm()

  async function act(
    job: Pick<AdminQueueJobRow, 'id' | 'queue' | 'name'>,
    name: 'retry' | 'cancel',
    options: { preserveScroll?: boolean } = {}
  ) {
    const confirmed = await confirm({
      message: t(`admin.queue.actions.${name}Confirm`, { name: job.name }),
      ...JOB_ACTION_CONFIRM[name],
      confirmLabel: t(JOB_ACTION_CONFIRM[name].confirmLabel),
    })
    if (!confirmed) return
    router.post(
      urlFor(`admin.queue.${name}`, { locale: locale.value, queue: job.queue, id: job.id }),
      {},
      options
    )
  }

  return { act }
}
