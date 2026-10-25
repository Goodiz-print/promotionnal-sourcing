<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import { formatDateTime } from '~/components/orders/types'
import type { OrderTimelineType } from '#shared/types/order'

/**
 * Frise du parcours d'une commande. Une commande annulée n'affiche que sa
 * création et son annulation ; sinon chaque étape non atteinte reste grisée.
 */
const props = defineProps<{ timeline: OrderTimelineType }>()

const { t, locale } = useI18n()

interface Step {
  key: string
  at: string | null
}

const steps = computed<Step[]>(() => {
  const { timeline } = props
  if (timeline.cancelledAt) {
    return [
      { key: 'created', at: timeline.createdAt },
      { key: 'cancelled', at: timeline.cancelledAt },
    ]
  }
  return [
    { key: 'created', at: timeline.createdAt },
    { key: 'confirmed', at: timeline.confirmedAt },
    { key: 'inProduction', at: timeline.inProductionAt },
    { key: 'shipped', at: timeline.shippedAt },
    { key: 'delivered', at: timeline.deliveredAt },
  ]
})
</script>

<template>
  <ol class="flex flex-col gap-3">
    <li v-for="step in steps" :key="step.key" class="flex items-start gap-3">
      <span
        class="mt-1.5 size-2.5 shrink-0 rounded-full"
        :class="
          step.at
            ? step.key === 'cancelled'
              ? 'bg-[var(--state-danger)]'
              : 'bg-[var(--primary-9)]'
            : 'bg-[var(--gray-4)]'
        "
        aria-hidden="true"
      />
      <div>
        <p :class="step.at ? 'font-medium' : 'text-[var(--gray-6)]'">
          {{ t(`order.timeline.${step.key}`) }}
        </p>
        <p v-if="step.at" class="text-sm text-[var(--gray-6)]">
          {{ formatDateTime(step.at, locale) }}
        </p>
        <p v-else class="text-sm text-[var(--gray-6)]">{{ t('order.timeline.pending') }}</p>
      </div>
    </li>
  </ol>
</template>
