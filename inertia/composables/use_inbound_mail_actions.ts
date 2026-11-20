import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'

/**
 * Actions de la supervision des mails entrants (#227) : confirmation puis
 * visite Inertia. Partagé par la liste et la fiche.
 */
export function useInboundMailActions() {
  const { t, locale } = useI18n()

  function attach(id: number, rfqSupplierId: number) {
    if (!window.confirm(t('admin.inboundMail.actions.attachConfirm'))) return
    router.post(
      urlFor('admin.inbound_mail.attach', { locale: locale.value, id }),
      { rfqSupplierId },
      { preserveScroll: true }
    )
  }

  function replay(id: number) {
    if (!window.confirm(t('admin.inboundMail.actions.replayConfirm'))) return
    router.post(
      urlFor('admin.inbound_mail.replay', { locale: locale.value, id }),
      {},
      { preserveScroll: true }
    )
  }

  function dismiss(id: number) {
    if (!window.confirm(t('admin.inboundMail.actions.dismissConfirm'))) return
    router.post(
      urlFor('admin.inbound_mail.dismiss', { locale: locale.value, id }),
      {},
      { preserveScroll: true }
    )
  }

  return { attach, replay, dismiss }
}
