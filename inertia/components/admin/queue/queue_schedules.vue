<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { Play } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useConfirm } from '~/composables/use_confirm'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import BaseButton from '~/components/base/base_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminQueueScheduleRow } from '#shared/types/admin_queue'

/** Jobs planifiés (`start/scheduler.ts`) : dernier passage, prochain passage, lancement manuel. */
defineProps<{ schedules: AdminQueueScheduleRow[] }>()

const { t, locale } = useI18n()
const { confirm } = useConfirm()
const { dateTime } = useTradeFormat()

async function run(schedule: AdminQueueScheduleRow) {
  const confirmed = await confirm({
    message: t('admin.queue.schedules.confirmRun', { name: schedule.name }),
    confirmLabel: t('admin.queue.schedules.run'),
  })
  if (!confirmed) return
  router.post(
    urlFor('admin.queue.schedules.run', { locale: locale.value, id: schedule.id }),
    {},
    { preserveScroll: true }
  )
}

// Dépend de `t` (i18n du composant) : reste dans le composant.
function timing(schedule: AdminQueueScheduleRow): string {
  if (schedule.cron) return `${schedule.cron} (${schedule.timezone})`
  if (!schedule.everyMs) return '—'
  return t('admin.queue.schedules.every', { seconds: Math.round(schedule.everyMs / 1000) })
}
</script>

<template>
  <BaseSection
    :title="t('admin.queue.schedules.title')"
    :description="t('admin.queue.schedules.description')"
    flush
  >
    <p v-if="schedules.length === 0" class="px-6 py-4 text-body-sm text-text-secondary">
      {{ t('admin.queue.schedules.empty') }}
    </p>
    <BaseTable v-else :caption="t('admin.queue.schedules.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.queue.schedules.columns.job') }}</th>
          <th scope="col">{{ t('admin.queue.schedules.columns.timing') }}</th>
          <th scope="col">{{ t('admin.queue.schedules.columns.lastRun') }}</th>
          <th scope="col">{{ t('admin.queue.schedules.columns.nextRun') }}</th>
          <th scope="col">{{ t('admin.queue.schedules.columns.runs') }}</th>
          <th scope="col">
            <span class="sr-only">{{ t('admin.queue.schedules.run') }}</span>
          </th>
        </tr>
      </template>
      <tr v-for="schedule in schedules" :key="schedule.id">
        <td class="font-semibold text-text-primary">
          {{ schedule.name }}
          <span class="block text-caption font-normal text-text-muted">{{ schedule.id }}</span>
        </td>
        <td class="text-tabular">{{ timing(schedule) }}</td>
        <td>{{ dateTime(schedule.lastRunAt) }}</td>
        <td>{{ dateTime(schedule.nextRunAt) }}</td>
        <td class="text-tabular">{{ schedule.runCount }}</td>
        <td class="text-right">
          <BaseButton v-if="schedule.runnable" variant="secondary" size="sm" @click="run(schedule)">
            <Play :size="16" aria-hidden="true" />
            {{ t('admin.queue.schedules.run') }}
          </BaseButton>
        </td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
