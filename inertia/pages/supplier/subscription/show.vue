<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { useSubscriptionActions } from '~/composables/use_subscription_actions'
import BaseAlert from '~/components/base/base_alert.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import SubscriptionCurrent from '~/components/subscription/subscription_current.vue'
import SubscriptionPlanCard from '~/components/subscription/subscription_plan_card.vue'
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from '#shared/types/organization'
import type { SupplierSubscriptionPageProps } from '#shared/types/subscription'

const props = defineProps<SupplierSubscriptionPageProps>()

const { t } = useI18n()
const { pending, subscribe, openPortal } = useSubscriptionActions()

/**
 * Action d'une carte : souscrire en ligne sans abonnement en cours, changer de
 * formule via le portail quand l'abonnement en cours a été souscrit en ligne.
 */
function actionFor(plan: SubscriptionPlan): 'subscribe' | 'change' | null {
  if (plan === 'free' || plan === props.currentPlan || !props.onlineEnabled) return null
  if (!props.subscription) return 'subscribe'
  return props.subscription.origin === 'stripe' && props.portalAvailable ? 'change' : null
}
</script>

<template>
  <Head :title="t('subscription.page.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('subscription.page.title')"
      :description="t('subscription.page.subtitle')"
    />

    <BaseAlert v-if="checkoutStatus === 'success'" tone="success">
      {{ t('subscription.page.checkoutSuccess') }}
    </BaseAlert>
    <BaseAlert v-else-if="checkoutStatus === 'cancelled'" tone="warning">
      {{ t('subscription.page.checkoutCancelled') }}
    </BaseAlert>
    <BaseAlert v-if="!onlineEnabled" tone="info">
      {{ t('subscription.page.unavailable') }}
    </BaseAlert>

    <SubscriptionCurrent
      :current-plan="currentPlan"
      :subscription="subscription"
      :portal-available="portalAvailable"
      :portal-loading="pending === 'portal'"
      @portal="openPortal"
    />

    <div class="grid gap-6 lg:grid-cols-3">
      <SubscriptionPlanCard
        v-for="plan in SUBSCRIPTION_PLANS"
        :key="plan"
        :plan="plan"
        :current="plan === currentPlan"
        :action="actionFor(plan)"
        :loading="plan !== 'free' && pending === plan"
        @subscribe="plan !== 'free' && subscribe(plan)"
        @change="openPortal"
      />
    </div>

    <p class="text-caption text-text-muted">{{ t('subscription.page.taxNote') }}</p>
  </div>
</template>
