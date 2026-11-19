<script setup lang="ts">
import { computed } from 'vue'
import { CreditCard } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useAdFormat } from '~/composables/use_ad_format'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseDescriptionItem from '~/components/base/base_description_item.vue'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { BadgeTone } from '~/types/ui'
import type { SubscriptionPlan } from '#shared/types/organization'
import type { CurrentSubscriptionType, SubscriptionStatus } from '#shared/types/subscription'

/**
 * Abonnement en cours du fournisseur : formule, statut, échéance, et accès au
 * portail de facturation (formule, résiliation, moyen de paiement, factures).
 */
const props = defineProps<{
  currentPlan: SubscriptionPlan
  subscription: CurrentSubscriptionType | null
  portalAvailable: boolean
  portalLoading: boolean
}>()

const emit = defineEmits<{ portal: [] }>()

const { t } = useI18n()
const { dateTime } = useAdFormat()

const STATUS_TONES: Record<SubscriptionStatus, BadgeTone> = {
  scheduled: 'info',
  pending: 'warning',
  active: 'success',
  past_due: 'danger',
  expired: 'neutral',
  cancelled: 'neutral',
}

const endLabel = computed(() =>
  props.subscription?.cancelAtPeriodEnd
    ? t('subscription.current.endsOn')
    : t('subscription.current.renewsOn')
)
</script>

<template>
  <BaseSection :title="t('subscription.current.title')">
    <div class="flex flex-col gap-4">
      <BaseAlert v-if="subscription?.status === 'past_due'" tone="danger">
        {{ t('subscription.current.pastDue') }}
      </BaseAlert>
      <BaseAlert v-else-if="subscription?.cancelAtPeriodEnd" tone="warning">
        {{ t('subscription.current.cancelScheduled') }}
      </BaseAlert>

      <BaseDescriptionList>
        <BaseDescriptionItem :label="t('subscription.current.plan')">
          {{ t(`subscription.plans.${currentPlan}.name`) }}
        </BaseDescriptionItem>
        <BaseDescriptionItem v-if="subscription" :label="t('subscription.current.status')">
          <BaseBadge :tone="STATUS_TONES[subscription.status]" dot>
            {{ t(`subscription.status.${subscription.status}`) }}
          </BaseBadge>
        </BaseDescriptionItem>
        <BaseDescriptionItem v-if="subscription" :label="t('subscription.current.since')">
          {{ dateTime(subscription.startsAt) }}
        </BaseDescriptionItem>
        <BaseDescriptionItem v-if="subscription?.endsAt" :label="endLabel">
          {{ dateTime(subscription.endsAt) }}
        </BaseDescriptionItem>
      </BaseDescriptionList>

      <p v-if="subscription?.origin === 'manual'" class="text-body-sm text-text-secondary">
        {{ t('subscription.current.manual') }}
      </p>

      <div v-if="portalAvailable">
        <BaseButton variant="secondary" :loading="portalLoading" @click="emit('portal')">
          <template #icon><CreditCard aria-hidden="true" /></template>
          {{ t('subscription.current.manage') }}
        </BaseButton>
      </div>
    </div>
  </BaseSection>
</template>
