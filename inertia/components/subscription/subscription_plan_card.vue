<script setup lang="ts">
import { computed } from 'vue'
import { Check, Minus } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useAdFormat } from '~/composables/use_ad_format'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import type { SubscriptionPlan } from '#shared/types/organization'
import {
  SUBSCRIPTION_FEATURES,
  SUBSCRIPTION_FEATURE_INCLUDED,
  SUBSCRIPTION_MONTHLY_PRICES_CENTS,
} from '#shared/types/subscription'

/**
 * Carte d'une formule de la page tarifs : prix mensuel, droits inclus et
 * action. `action` vaut `subscribe` (souscrire en ligne), `change` (changer de
 * formule via le portail) ou `null` (aucune action possible).
 */
const props = defineProps<{
  plan: SubscriptionPlan
  current: boolean
  action: 'subscribe' | 'change' | null
  loading: boolean
}>()

const emit = defineEmits<{ subscribe: []; change: [] }>()

const { t } = useI18n()
const { money } = useAdFormat()

const price = computed(() =>
  props.plan === 'free' ? money(0) : money(SUBSCRIPTION_MONTHLY_PRICES_CENTS[props.plan])
)

const features = computed(() =>
  SUBSCRIPTION_FEATURES.map((feature) => ({
    key: feature,
    included: SUBSCRIPTION_FEATURE_INCLUDED[feature][props.plan],
    label: t(`subscription.features.${feature}.${props.plan}`),
  }))
)
</script>

<template>
  <BaseCard
    as="article"
    padding="md"
    class="flex flex-col gap-6"
    :class="current && 'ring-2 ring-indigo-500'"
  >
    <header class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-heading-sm text-text-primary">
          {{ t(`subscription.plans.${plan}.name`) }}
        </h2>
        <BaseBadge v-if="current" tone="brand">{{ t('subscription.plans.current') }}</BaseBadge>
      </div>
      <p class="text-body-sm text-text-secondary">{{ t(`subscription.plans.${plan}.tagline`) }}</p>
      <p class="flex items-baseline gap-1">
        <span class="font-heading text-tabular text-display-md text-text-primary">{{ price }}</span>
        <span class="text-body-sm text-text-muted">{{ t('subscription.plans.perMonth') }}</span>
      </p>
    </header>

    <ul class="flex flex-1 flex-col gap-3">
      <li v-for="feature in features" :key="feature.key" class="flex gap-2 text-body-sm">
        <Check
          v-if="feature.included"
          :size="18"
          class="shrink-0 text-success"
          aria-hidden="true"
        />
        <Minus v-else :size="18" class="shrink-0 text-text-muted" aria-hidden="true" />
        <span :class="feature.included ? 'text-text-primary' : 'text-text-muted'">
          {{ feature.label }}
        </span>
      </li>
    </ul>

    <BaseButton v-if="action === 'subscribe'" block :loading="loading" @click="emit('subscribe')">
      {{ t('subscription.plans.subscribe') }}
    </BaseButton>
    <BaseButton
      v-else-if="action === 'change'"
      block
      variant="secondary"
      :loading="loading"
      @click="emit('change')"
    >
      {{ t('subscription.plans.change') }}
    </BaseButton>
  </BaseCard>
</template>
