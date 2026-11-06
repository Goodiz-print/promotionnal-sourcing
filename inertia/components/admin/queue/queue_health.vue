<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseSection from '~/components/base/base_section.vue'
import { QUEUE_THRESHOLDS, type QueueHealthReport } from '#shared/types/health'
import type { QueueJobStatus } from '#shared/types/admin_queue'

/**
 * Rapport de santé de la queue (`HealthService.queueReport`, mêmes seuils que
 * `queue:health`) et effectifs par état. Sert l'écran de supervision et le
 * tableau de bord (`linked` : lien vers l'écran de supervision).
 */
const props = defineProps<{
  health: QueueHealthReport
  counts?: Record<QueueJobStatus, number>
  linked?: boolean
}>()

const { t, locale } = useI18n()
const { dateTime } = useTradeFormat()

const minutes = (ms: number) => t('admin.queue.minutes', { count: Math.round(ms / 60_000) })
const oldest = computed(() =>
  props.health.oldestPendingAgeMs === null ? '—' : minutes(props.health.oldestPendingAgeMs)
)

const figures = computed(() => [
  {
    key: 'pendingOverdue',
    value: props.health.pendingOverdue,
    hint: t('admin.queue.health.pendingOverdueHint', {
      minutes: QUEUE_THRESHOLDS.pendingOverdueMs / 60_000,
    }),
  },
  { key: 'oldestPending', value: oldest.value, hint: undefined },
  {
    key: 'stuckActive',
    value: props.health.stuckActive,
    hint: t('admin.queue.health.stuckActiveHint', {
      minutes: QUEUE_THRESHOLDS.activeStuckMs / 60_000,
    }),
  },
  { key: 'failedLast24h', value: props.health.failedLast24h, hint: undefined },
])
</script>

<template>
  <BaseSection
    :title="t('admin.queue.health.title')"
    :description="t('admin.queue.health.checkedAt', { date: dateTime(health.checkedAt) })"
  >
    <div class="flex flex-col gap-4">
      <BaseAlert :tone="health.ok ? 'success' : 'danger'">
        {{ t(health.ok ? 'admin.queue.health.ok' : 'admin.queue.health.ko') }}
        <Link
          v-if="linked"
          :href="urlFor('admin.queue.index', { locale })"
          class="ml-2 font-semibold underline"
        >
          {{ t('admin.queue.health.details') }}
        </Link>
      </BaseAlert>

      <dl class="grid gap-4 text-body-sm sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="figure in figures" :key="figure.key">
          <dt class="text-text-secondary">{{ t(`admin.queue.health.${figure.key}`) }}</dt>
          <dd class="text-tabular font-semibold text-text-primary">{{ figure.value }}</dd>
          <dd v-if="figure.hint" class="text-caption text-text-muted">{{ figure.hint }}</dd>
        </div>
      </dl>

      <dl
        v-if="counts"
        class="grid gap-4 border-t border-hairline pt-4 text-body-sm sm:grid-cols-5"
      >
        <div v-for="(total, status) in counts" :key="status">
          <dt class="text-text-secondary">{{ t(`admin.queue.statuses.${status}`) }}</dt>
          <dd class="text-tabular font-semibold text-text-primary">{{ total }}</dd>
        </div>
      </dl>
    </div>
  </BaseSection>
</template>
