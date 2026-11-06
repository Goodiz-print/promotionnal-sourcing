import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import type { MailKind } from '#shared/types/mail'

/**
 * Rejeu d'emails depuis le back-office (#178) : confirmation puis visite Inertia.
 * Partagé par la liste, la fiche et le tableau des taux d'échec.
 */
export function useMailActions() {
  const { t, locale } = useI18n()

  function retry(id: number, options: { preserveScroll?: boolean } = {}) {
    if (!window.confirm(t('admin.mail.actions.retryConfirm'))) return
    router.post(urlFor('admin.mail.retry', { locale: locale.value, id }), {}, options)
  }

  /** Rejoue toute la dead-letter, ou un seul type de mail. */
  function retryAll(kind: MailKind | null) {
    const message = kind
      ? t('admin.mail.actions.retryKindConfirm', { kind: t(`admin.mail.kinds.${kind}`) })
      : t('admin.mail.actions.retryAllConfirm')
    if (!window.confirm(message)) return
    router.post(urlFor('admin.mail.retryAll', { locale: locale.value }), kind ? { kind } : {}, {
      preserveScroll: true,
    })
  }

  return { retry, retryAll }
}
