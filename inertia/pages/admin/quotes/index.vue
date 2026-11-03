<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { FileCheck } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import { useTradeListVisit } from '~/composables/use_trade_list_visit'
import TradeFilters from '~/components/admin/trade_filters.vue'
import TradeList from '~/components/admin/trade_list.vue'
import TradeStatusBadge from '~/components/admin/trade_status_badge.vue'
import type { AdminQuoteFilters, AdminQuoteRow } from '#shared/types/admin_trade'
import type { Paginated } from '#shared/types/pagination'
import { QUOTE_STATUSES } from '#shared/types/quote'

const props = defineProps<{ quotes: Paginated<AdminQuoteRow>; filters: AdminQuoteFilters }>()

const { t, locale } = useI18n()
const { money, dateTime } = useTradeFormat()
const { visit, goToPage } = useTradeListVisit('admin.quotes.index', ['quotes', 'filters'])

const showUrl = (quote: AdminQuoteRow) =>
  urlFor('admin.quotes.show', { locale: locale.value, id: quote.id })
</script>

<template>
  <Head :title="t('admin.quotes.title')" />

  <TradeList
    :title="t('admin.quotes.title')"
    :description="t('admin.quotes.subtitle')"
    :count-label="t('admin.quotes.resultsCount', { count: quotes.meta.total })"
    :empty-title="t('admin.quotes.empty')"
    :empty-description="t('admin.quotes.emptyDescription')"
    :icon="FileCheck"
    :meta="quotes.meta"
    @page="(page) => goToPage(props.filters, page)"
  >
    <template #filters>
      <TradeFilters
        :filters="filters"
        :statuses="QUOTE_STATUSES"
        status-prefix="quote.status"
        @change="visit"
      />
    </template>

    <template #head>
      <tr>
        <th scope="col">{{ t('admin.quotes.columns.quote') }}</th>
        <th scope="col">{{ t('admin.quotes.columns.rfq') }}</th>
        <th scope="col">{{ t('admin.trade.columns.buyer') }}</th>
        <th scope="col">{{ t('admin.trade.columns.supplier') }}</th>
        <th scope="col">{{ t('admin.trade.columns.status') }}</th>
        <th scope="col" class="text-right">{{ t('admin.trade.columns.amount') }}</th>
        <th scope="col">{{ t('admin.quotes.columns.submitted') }}</th>
      </tr>
    </template>

    <tr v-for="quote in quotes.data" :key="quote.id">
      <td>
        <Link :href="showUrl(quote)" class="font-semibold text-text-primary hover:text-indigo-600">
          {{ t('admin.quotes.number', { id: quote.id }) }}
        </Link>
      </td>
      <td>{{ quote.rfqTitle }}</td>
      <td>{{ quote.buyer.name }}</td>
      <td>{{ quote.supplier.name }}</td>
      <td><TradeStatusBadge kind="quote" :status="quote.status" /></td>
      <td class="text-tabular text-right">{{ money(quote.totalAmount, quote.currency) }}</td>
      <td class="text-tabular whitespace-nowrap">{{ dateTime(quote.submittedAt) }}</td>
    </tr>
  </TradeList>
</template>
