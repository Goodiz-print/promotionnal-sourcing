<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import { formatDateTime } from '#shared/helpers/date'
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

/** Dernière étape atteinte : la seule soulignée d'un halo. */
const currentKey = computed(() => steps.value.filter((step) => step.at).at(-1)?.key)

function dotClass(step: Step): string {
  if (!step.at) return 'bg-ink-200'
  if (step.key === 'cancelled') return 'bg-danger ring-4 ring-danger-bg'
  return step.key === currentKey.value ? 'bg-indigo-500 ring-4 ring-brand-subtle' : 'bg-indigo-500'
}
</script>

<template>
  <ol class="flex flex-col">
    <li
      v-for="step in steps"
      :key="step.key"
      class="relative border-l-2 border-hairline pb-6 pl-6 last:pb-0"
    >
      <span
        class="absolute top-1 -left-[7px] size-3 rounded-full"
        :class="dotClass(step)"
        aria-hidden="true"
      />
      <p
        class="text-body-sm font-semibold"
        :class="step.at ? 'text-text-primary' : 'text-text-muted'"
      >
        {{ t(`order.timeline.${step.key}`) }}
      </p>
      <p v-if="step.at" class="text-tabular text-caption text-text-muted">
        {{ formatDateTime(step.at, locale) }}
      </p>
      <p v-else class="text-caption text-text-muted">{{ t('order.timeline.pending') }}</p>
    </li>
  </ol>
</template>
