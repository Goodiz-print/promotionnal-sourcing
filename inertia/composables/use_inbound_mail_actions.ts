import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { useConfirm } from '~/composables/use_confirm'
import type { ConfirmTone } from '~/types/ui'

type InboundMailAction = 'attach' | 'replay' | 'dismiss'

/** Ton de la confirmation : écarter un mail l'exclut du traitement. */
const ACTION_TONES: Record<InboundMailAction, ConfirmTone> = {
  attach: 'default',
  replay: 'default',
  dismiss: 'danger',
}

/**
 * Actions de la supervision des mails entrants (#227) : confirmation puis
 * visite Inertia. Partagé par la liste et la fiche.
 */
export function useInboundMailActions() {
  const { t, locale } = useI18n()
  const { confirm } = useConfirm()

  /** `action` nomme le message, le bouton et la route. */
  async function run(action: InboundMailAction, id: number, data: Record<string, number> = {}) {
    const confirmed = await confirm({
      message: t(`admin.inboundMail.actions.${action}Confirm`),
      confirmLabel: t(`admin.inboundMail.actions.${action}`),
      tone: ACTION_TONES[action],
    })
    if (!confirmed) return
    router.post(urlFor(`admin.inbound_mail.${action}`, { locale: locale.value, id }), data, {
      preserveScroll: true,
    })
  }

  return {
    attach: (id: number, rfqSupplierId: number) => run('attach', id, { rfqSupplierId }),
    replay: (id: number) => run('replay', id),
    dismiss: (id: number) => run('dismiss', id),
  }
}
