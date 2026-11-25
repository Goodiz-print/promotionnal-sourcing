import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { useConfirm } from '~/composables/use_confirm'
import type { ConfirmOptions } from '~/types/ui'
import type { PaidSubscriptionPlan } from '#shared/types/subscription'

/** Saisie d'un abonnement manuel : formule et jours `AAAA-MM-JJ` (fin incluse). */
export interface SubscriptionDraft {
  plan: PaidSubscriptionPlan
  startsOn: string
  endsOn: string
}

/**
 * Abonnement manuel d'une organisation depuis le back-office (#214) : chaque
 * mutation est une visite Inertia (`preserveScroll`), le serveur répond par une
 * redirection + flash. La résiliation demande une confirmation.
 */
export function useAdminSubscriptionActions(organizationId: number) {
  const { locale } = useI18n()
  const { confirm } = useConfirm()
  const processing = ref(false)

  const visitOptions = {
    preserveScroll: true,
    onStart: () => (processing.value = true),
    onFinish: () => (processing.value = false),
  }

  const base = () => ({ locale: locale.value, id: organizationId })

  function create(draft: SubscriptionDraft) {
    router.post(
      urlFor('admin.organizations.subscriptions.store', base()),
      { ...draft },
      visitOptions
    )
  }

  function extend(subscriptionId: number, endsOn: string) {
    router.patch(
      urlFor('admin.organizations.subscriptions.extend', { ...base(), subscriptionId }),
      { endsOn },
      visitOptions
    )
  }

  async function cancel(subscriptionId: number, confirmation: ConfirmOptions) {
    if (!(await confirm(confirmation))) return
    router.post(
      urlFor('admin.organizations.subscriptions.cancel', { ...base(), subscriptionId }),
      {},
      visitOptions
    )
  }

  return { processing, create, extend, cancel }
}
