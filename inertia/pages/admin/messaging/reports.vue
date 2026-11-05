<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Flag } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import TradeList from '~/components/admin/trade_list.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { MESSAGE_REPORT_STATUSES } from '#shared/types/conversation'
import type { AdminReportFilters, AdminReportRow } from '#shared/types/admin_messaging'
import type { MessageReportStatus } from '#shared/types/conversation'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<{ reports: Paginated<AdminReportRow>; filters: AdminReportFilters }>()

const { t, locale } = useI18n()
const { dateTime } = useTradeFormat()

function visit(status: MessageReportStatus, page = 1) {
  router.get(
    urlFor('admin.messaging.reports', { locale: locale.value }),
    { status, page },
    { preserveState: true, preserveScroll: true, only: ['reports', 'filters'] }
  )
}

const showUrl = (row: AdminReportRow) =>
  urlFor('admin.messaging.show', { locale: locale.value, id: row.conversationId })
</script>

<template>
  <Head :title="t('admin.messaging.reportsTitle')" />

  <TradeList
    :title="t('admin.messaging.reportsTitle')"
    :description="t('admin.messaging.reportsSubtitle')"
    :count-label="t('admin.messaging.reportsCount', { count: reports.meta.total })"
    :empty-title="t('admin.messaging.reportsEmpty')"
    :empty-description="t('admin.messaging.reportsEmptyDescription')"
    :icon="Flag"
    :meta="reports.meta"
    @page="(page) => visit(props.filters.status, page)"
  >
    <template #filters>
      <BaseCard padding="md">
        <BaseSelect
          id="report-status"
          :model-value="filters.status"
          :label="t('admin.trade.filters.status')"
          @update:model-value="(value) => visit(value as MessageReportStatus)"
        >
          <option v-for="status in MESSAGE_REPORT_STATUSES" :key="status" :value="status">
            {{ t(`admin.messaging.status.${status}`) }}
          </option>
        </BaseSelect>
      </BaseCard>
    </template>

    <template #head>
      <tr>
        <th scope="col">{{ t('admin.messaging.columns.reason') }}</th>
        <th scope="col">{{ t('admin.messaging.columns.message') }}</th>
        <th scope="col">{{ t('admin.messaging.columns.conversation') }}</th>
        <th scope="col">{{ t('admin.messaging.columns.reporter') }}</th>
        <th scope="col">{{ t('admin.messaging.columns.createdAt') }}</th>
      </tr>
    </template>

    <tr v-for="row in reports.data" :key="row.id">
      <td class="font-semibold text-text-primary">
        {{ t(`admin.messaging.reasons.${row.reason}`) }}
        <BaseBadge v-if="row.resolution" tone="neutral">
          {{ t(`admin.messaging.resolutions.${row.resolution}`) }}
        </BaseBadge>
      </td>
      <td class="max-w-xs truncate">{{ row.messageExcerpt || t('admin.messaging.hidden') }}</td>
      <td>
        <Link :href="showUrl(row)">
          {{ row.conversationSubject ?? t('admin.messaging.untitled', { id: row.conversationId }) }}
        </Link>
        <span class="block text-caption text-text-secondary">
          {{ row.buyerName }} · {{ row.supplierName }}
        </span>
      </td>
      <td>{{ row.reporterEmail ?? '—' }}</td>
      <td>{{ dateTime(row.createdAt) }}</td>
    </tr>
  </TradeList>
</template>
