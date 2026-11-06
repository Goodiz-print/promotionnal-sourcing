<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Layers } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useQueueJobActions } from '~/composables/use_queue_job_actions'
import { useTradeFormat } from '~/composables/use_trade_format'
import QueueHealth from '~/components/admin/queue/queue_health.vue'
import QueueSchedules from '~/components/admin/queue/queue_schedules.vue'
import QueueStatusBadge from '~/components/admin/queue/queue_status_badge.vue'
import TradeList from '~/components/admin/trade_list.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import type {
  AdminQueueFilters,
  AdminQueueJobRow,
  AdminQueueOverview,
  QueueJobFilterStatus,
} from '#shared/types/admin_queue'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<{
  overview: AdminQueueOverview
  jobs: Paginated<AdminQueueJobRow>
  filters: AdminQueueFilters
  statuses: QueueJobFilterStatus[]
}>()

const { t, locale } = useI18n()
const { dateTime } = useTradeFormat()
const { act } = useQueueJobActions()

const model = reactive({ ...props.filters })
// Les filtres du serveur font foi (retour arrière, pagination…).
watch(
  () => props.filters,
  () => Object.assign(model, props.filters),
  { deep: true }
)

function visit(page = 1) {
  const query: Record<string, string | number> = { page }
  if (model.status) query.status = model.status
  if (model.name?.trim()) query.name = model.name.trim()
  router.get(urlFor('admin.queue.index', { locale: locale.value }), query, {
    preserveState: true,
    preserveScroll: true,
    only: ['overview', 'jobs', 'filters'],
  })
}

function reset() {
  Object.assign(model, { status: null, name: null })
  visit()
}

const jobUrl = (row: AdminQueueJobRow, name: 'show' | 'retry' | 'cancel') =>
  urlFor(`admin.queue.${name}`, { locale: locale.value, queue: row.queue, id: row.id })
</script>

<template>
  <Head :title="t('admin.queue.title')" />

  <TradeList
    :title="t('admin.queue.title')"
    :description="t('admin.queue.subtitle')"
    :count-label="t('admin.queue.resultsCount', { count: jobs.meta.total })"
    :empty-title="t('admin.queue.empty')"
    :empty-description="t('admin.queue.emptyDescription')"
    :icon="Layers"
    :meta="jobs.meta"
    @page="visit"
  >
    <template #filters>
      <QueueHealth :health="overview.health" :counts="overview.counts" />
      <QueueSchedules :schedules="overview.schedules" />

      <BaseCard padding="md">
        <form class="flex flex-col gap-4" @submit.prevent="visit()">
          <div class="grid gap-4 sm:grid-cols-2">
            <BaseSelect
              id="queue-status"
              v-model="model.status"
              :label="t('admin.queue.filters.status')"
            >
              <option :value="null">{{ t('admin.queue.filters.all') }}</option>
              <option v-for="status in statuses" :key="status" :value="status">
                {{
                  status === 'stuck' ? t('admin.queue.stuck') : t(`admin.queue.statuses.${status}`)
                }}
              </option>
            </BaseSelect>
            <BaseInput
              id="queue-name"
              :model-value="model.name ?? ''"
              :label="t('admin.queue.filters.name')"
              @update:model-value="model.name = $event"
            />
          </div>
          <div class="flex justify-end gap-3">
            <BaseButton variant="secondary" size="sm" @click="reset">
              {{ t('admin.trade.filters.reset') }}
            </BaseButton>
            <BaseButton type="submit" size="sm">{{ t('admin.trade.filters.apply') }}</BaseButton>
          </div>
        </form>
      </BaseCard>
    </template>

    <template #head>
      <tr>
        <th scope="col">{{ t('admin.queue.columns.job') }}</th>
        <th scope="col">{{ t('admin.queue.columns.status') }}</th>
        <th scope="col">{{ t('admin.queue.columns.attempts') }}</th>
        <th scope="col">{{ t('admin.queue.columns.date') }}</th>
        <th scope="col">{{ t('admin.queue.columns.error') }}</th>
        <th scope="col">
          <span class="sr-only">{{ t('admin.queue.columns.actions') }}</span>
        </th>
      </tr>
    </template>

    <tr v-for="row in jobs.data" :key="`${row.queue}:${row.id}`">
      <td class="font-semibold text-text-primary">
        <Link :href="jobUrl(row, 'show')">{{ row.name }}</Link>
        <span class="block text-caption font-normal text-text-muted">{{ row.queue }}</span>
      </td>
      <td><QueueStatusBadge :status="row.status" :stuck="row.stuck" :overdue="row.overdue" /></td>
      <td class="text-tabular">{{ row.attempts }}</td>
      <td>{{ dateTime(row.at) }}</td>
      <td class="max-w-xs truncate">{{ row.error ?? '—' }}</td>
      <td class="text-right">
        <div class="flex justify-end gap-2">
          <BaseButton
            v-if="row.retryable"
            size="sm"
            @click="act(row, 'retry', { preserveScroll: true })"
          >
            {{ t('admin.queue.actions.retry') }}
          </BaseButton>
          <BaseButton
            v-if="row.cancellable"
            variant="secondary"
            size="sm"
            @click="act(row, 'cancel', { preserveScroll: true })"
          >
            {{ t('admin.queue.actions.cancel') }}
          </BaseButton>
        </div>
      </td>
    </tr>
  </TradeList>
</template>
