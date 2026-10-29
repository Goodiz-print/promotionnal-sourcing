<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'
import { PackageOpen } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseTable from '~/components/base/base_table.vue'
import OrderActions from '~/components/orders/order_actions.vue'
import { ORDER_STATUS_TONES } from '~/components/orders/types'
import { formatMoney } from '~/components/quotes/types'
import type { OrderSide, OrderType } from '#shared/types/order'

/**
 * Liste de commandes, commune aux deux côtés. Côté fournisseur, l'action
 * suivante de chaque commande se déclenche depuis la ligne.
 */
defineProps<{ orders: OrderType[]; side: OrderSide; emptyKey: string }>()

const { t, locale } = useI18n()
</script>

<template>
  <BaseEmptyState v-if="orders.length === 0" :title="t(emptyKey)" :icon="PackageOpen" />

  <BaseTable v-else :caption="t('order.index.title')">
    <template #head>
      <tr>
        <th scope="col">{{ t('order.index.columns.order') }}</th>
        <th scope="col">
          {{ side === 'buyer' ? t('order.show.supplier') : t('order.show.buyer') }}
        </th>
        <th scope="col" class="text-right">{{ t('order.index.columns.total') }}</th>
        <th scope="col">{{ t('order.index.columns.status') }}</th>
        <th v-if="side === 'supplier'" scope="col" class="text-right">
          {{ t('order.index.columns.actions') }}
        </th>
      </tr>
    </template>

    <tr v-for="order in orders" :key="order.id">
      <td>
        <Link
          :route="side === 'buyer' ? 'orders.show' : 'supplier.orders.show'"
          :params="{ locale, id: order.id }"
          class="font-semibold text-text-primary hover:text-indigo-600"
        >
          {{ t('order.show.title', { id: order.id }) }}
        </Link>
        <p class="text-caption text-text-muted">{{ order.rfqTitle }}</p>
      </td>
      <td>{{ side === 'buyer' ? order.supplierName : order.buyerName }}</td>
      <td class="text-tabular text-right font-semibold whitespace-nowrap">
        {{ formatMoney(order.totalAmount, order.currency, locale) }}
      </td>
      <td>
        <BaseBadge dot :tone="ORDER_STATUS_TONES[order.status]">
          {{ t(`order.status.${order.status}`) }}
        </BaseBadge>
      </td>
      <td v-if="side === 'supplier'" class="text-right">
        <div class="flex justify-end">
          <OrderActions :order="order" :side="side" />
        </div>
      </td>
    </tr>
  </BaseTable>
</template>
