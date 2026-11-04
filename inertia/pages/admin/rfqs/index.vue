<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { FileText } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import { useTradeListVisit } from '~/composables/use_trade_list_visit'
import TradeFilters from '~/components/admin/trade_filters.vue'
import TradeList from '~/components/admin/trade_list.vue'
import TradeStatusBadge from '~/components/admin/trade_status_badge.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import { RFQ_ATTENTION_FLAGS } from '#shared/types/admin_trade'
import type { AdminRfqFilters, AdminRfqRow } from '#shared/types/admin_trade'
import type { Paginated } from '#shared/types/pagination'
import { RFQ_STATUSES } from '#shared/types/rfq'

const props = defineProps<{ rfqs: Paginated<AdminRfqRow>; filters: AdminRfqFilters }>()

const { t, locale } = useI18n()
const { dateTime } = useTradeFormat()
const { visit, goToPage } = useTradeListVisit('admin.rfqs.index', ['rfqs', 'filters'])

const showUrl = (rfq: AdminRfqRow) =>
  urlFor('admin.rfqs.show', { locale: locale.value, id: rfq.id })
</script>

<template>
  <Head :title="t('admin.rfqs.title')" />

  <TradeList
    :title="t('admin.rfqs.title')"
    :description="t('admin.rfqs.subtitle')"
    :count-label="t('admin.rfqs.resultsCount', { count: rfqs.meta.total })"
    :empty-title="t('admin.rfqs.empty')"
    :empty-description="t('admin.rfqs.emptyDescription')"
    :icon="FileText"
    :meta="rfqs.meta"
    @page="(page) => goToPage(props.filters, page)"
  >
    <template #filters>
      <TradeFilters
        :filters="filters"
        :statuses="RFQ_STATUSES"
        status-prefix="rfq.status"
        :attentions="RFQ_ATTENTION_FLAGS"
        @change="visit"
      />
    </template>

    <template #head>
      <tr>
        <th scope="col">{{ t('admin.rfqs.columns.title') }}</th>
        <th scope="col">{{ t('admin.trade.columns.buyer') }}</th>
        <th scope="col">{{ t('admin.trade.columns.status') }}</th>
        <th scope="col">{{ t('admin.rfqs.columns.deadline') }}</th>
        <th scope="col" class="text-right">{{ t('admin.rfqs.columns.recipients') }}</th>
        <th scope="col" class="text-right">{{ t('admin.rfqs.columns.responses') }}</th>
        <th scope="col" class="text-right">{{ t('admin.rfqs.columns.quotes') }}</th>
        <th scope="col">{{ t('admin.rfqs.columns.attention') }}</th>
      </tr>
    </template>

    <tr v-for="rfq in rfqs.data" :key="rfq.id">
      <td>
        <Link :href="showUrl(rfq)" class="font-semibold text-text-primary hover:text-indigo-600">
          {{ rfq.title }}
        </Link>
      </td>
      <td>{{ rfq.buyer.name }}</td>
      <td><TradeStatusBadge kind="rfq" :status="rfq.status" /></td>
      <td class="text-tabular whitespace-nowrap">{{ dateTime(rfq.deadline) }}</td>
      <td class="text-tabular text-right">{{ rfq.suppliersCount }}</td>
      <td class="text-tabular text-right">{{ rfq.respondedCount }}</td>
      <td class="text-tabular text-right">{{ rfq.quotesCount }}</td>
      <td>
        <BaseBadge v-if="rfq.attention" tone="warning">
          {{ t(`admin.rfqs.attention.${rfq.attention}`) }}
        </BaseBadge>
      </td>
    </tr>
  </TradeList>
</template>
