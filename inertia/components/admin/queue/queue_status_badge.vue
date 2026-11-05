<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import type { QueueJobStatus } from '#shared/types/admin_queue'

/** Pastille d'état d'un job de queue ; `stuck` et `overdue` signalent un job à surveiller. */
defineProps<{ status: QueueJobStatus; stuck?: boolean; overdue?: boolean }>()

const { t } = useI18n()

const TONES: Record<QueueJobStatus, 'neutral' | 'info' | 'success' | 'danger' | 'warning'> = {
  pending: 'neutral',
  delayed: 'neutral',
  active: 'info',
  completed: 'success',
  failed: 'danger',
}
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-2">
    <BaseBadge :tone="TONES[status]">{{ t(`admin.queue.statuses.${status}`) }}</BaseBadge>
    <BaseBadge v-if="stuck" tone="warning">{{ t('admin.queue.stuck') }}</BaseBadge>
    <BaseBadge v-if="overdue" tone="warning">{{ t('admin.queue.overdue') }}</BaseBadge>
  </span>
</template>
