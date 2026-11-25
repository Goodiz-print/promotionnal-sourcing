import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { useConfirm } from '~/composables/use_confirm'
import { MAIL_BULK_RETRY_LIMIT } from '#shared/types/admin_ops'
import type { MailKind } from '#shared/types/mail'

/**
 * Rejeu d'emails depuis le back-office (#178) : confirmation puis visite Inertia.
 * Partagé par la liste, la fiche et le tableau des taux d'échec.
 */
export function useMailActions() {
  const { t, locale } = useI18n()
  const { confirm } = useConfirm()

  async function retry(id: number, options: { preserveScroll?: boolean } = {}) {
    const confirmed = await confirm({
      message: t('admin.mail.actions.retryConfirm'),
      confirmLabel: t('admin.mail.actions.retry'),
    })
    if (!confirmed) return
    router.post(urlFor('admin.mail.retry', { locale: locale.value, id }), {}, options)
  }

  /** Rejoue toute la dead-letter, ou un seul type de mail. */
  async function retryAll(kind: MailKind | null) {
    const message = kind
      ? t('admin.mail.actions.retryKindConfirm', {
          kind: t(`admin.mail.kinds.${kind}`),
          limit: MAIL_BULK_RETRY_LIMIT,
        })
      : t('admin.mail.actions.retryAllConfirm', { limit: MAIL_BULK_RETRY_LIMIT })
    if (!(await confirm({ message, confirmLabel: t('admin.mail.actions.retry') }))) return
    router.post(urlFor('admin.mail.retryAll', { locale: locale.value }), kind ? { kind } : {}, {
      preserveScroll: true,
    })
  }

  return { retry, retryAll }
}
