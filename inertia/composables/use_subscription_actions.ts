import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import type { PaidSubscriptionPlan } from '#shared/types/subscription'

/**
 * Actions de la page abonnement : ouverture de la page de souscription Stripe
 * et du portail de facturation. Le serveur répond par une redirection externe
 * (`inertia.location`) ou, en cas de refus, par un retour avec message flash.
 */
export function useSubscriptionActions() {
  const { locale } = useI18n()
  const pending = ref<PaidSubscriptionPlan | 'portal' | null>(null)

  const visit = (target: PaidSubscriptionPlan | 'portal', url: string, data = {}) => {
    pending.value = target
    router.post(url, data, { preserveScroll: true, onFinish: () => (pending.value = null) })
  }

  const subscribe = (plan: PaidSubscriptionPlan) =>
    visit(plan, urlFor('supplier.subscription.checkout', { locale: locale.value }), { plan })

  const openPortal = () =>
    visit('portal', urlFor('supplier.subscription.portal', { locale: locale.value }))

  return { pending, subscribe, openPortal }
}
