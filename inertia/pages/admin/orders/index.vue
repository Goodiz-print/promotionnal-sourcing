<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { ShoppingCart } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import { useTradeListVisit } from '~/composables/use_trade_list_visit'
import TradeFilters from '~/components/admin/trade_filters.vue'
import TradeList from '~/components/admin/trade_list.vue'
import TradeStatusBadge from '~/components/admin/trade_status_badge.vue'
import type { AdminOrderFilters, AdminOrderRow } from '#shared/types/admin_trade'
import { ORDER_STATUSES } from '#shared/types/order'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<{ orders: Paginated<AdminOrderRow>; filters: AdminOrderFilters }>()

const { t, locale } = useI18n()
const { money, dateTime } = useTradeFormat()
const { visit, goToPage } = useTradeListVisit('admin.orders.index', ['orders', 'filters'])

const showUrl = (order: AdminOrderRow) =>
  urlFor('admin.orders.show', { locale: locale.value, id: order.id })
</script>

<template>
  <Head :title="t('admin.orders.title')" />

  <TradeList
    :title="t('admin.orders.title')"
    :description="t('admin.orders.subtitle')"
    :count-label="t('admin.orders.resultsCount', { count: orders.meta.total })"
    :empty-title="t('admin.orders.empty')"
    :empty-description="t('admin.orders.emptyDescription')"
    :icon="ShoppingCart"
    :meta="orders.meta"
    @page="(page) => goToPage(props.filters, page)"
  >
    <template #filters>
      <TradeFilters
        :filters="filters"
        :statuses="ORDER_STATUSES"
        status-prefix="order.status"
        @change="visit"
      />
    </template>

    <template #head>
      <tr>
        <th scope="col">{{ t('admin.orders.columns.order') }}</th>
        <th scope="col">{{ t('admin.trade.columns.buyer') }}</th>
        <th scope="col">{{ t('admin.trade.columns.supplier') }}</th>
        <th scope="col">{{ t('admin.trade.columns.status') }}</th>
        <th scope="col" class="text-right">{{ t('admin.trade.columns.amount') }}</th>
        <th scope="col">{{ t('admin.orders.columns.created') }}</th>
      </tr>
    </template>

    <tr v-for="order in orders.data" :key="order.id">
      <td>
        <Link :href="showUrl(order)" class="font-semibold text-text-primary hover:text-indigo-600">
          {{ t('admin.orders.number', { id: order.id }) }}
        </Link>
      </td>
      <td>{{ order.buyer.name }}</td>
      <td>{{ order.supplier.name }}</td>
      <td><TradeStatusBadge kind="order" :status="order.status" /></td>
      <td class="text-tabular text-right">{{ money(order.totalAmount, order.currency) }}</td>
      <td class="text-tabular whitespace-nowrap">{{ dateTime(order.createdAt) }}</td>
    </tr>
  </TradeList>
</template>
