<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
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
  <p v-if="orders.length === 0" class="text-[var(--gray-6)]">{{ t(emptyKey) }}</p>

  <ul v-else class="flex flex-col gap-2">
    <li
      v-for="order in orders"
      :key="order.id"
      class="flex flex-col gap-3 rounded border border-[var(--gray-3)] p-4"
    >
      <div class="flex items-center gap-4">
        <div class="flex-1">
          <Link
            :route="side === 'buyer' ? 'orders.show' : 'supplier.orders.show'"
            :params="{ locale, id: order.id }"
            class="font-medium hover:underline"
          >
            {{ t('order.show.title', { id: order.id }) }} · {{ order.rfqTitle }}
          </Link>
          <p class="mt-0.5 text-sm text-[var(--gray-6)]">
            {{ side === 'buyer' ? order.supplierName : order.buyerName }} ·
            {{ formatMoney(order.totalAmount, order.currency, locale) }}
          </p>
        </div>
        <BaseBadge :tone="ORDER_STATUS_TONES[order.status]">
          {{ t(`order.status.${order.status}`) }}
        </BaseBadge>
      </div>
      <OrderActions v-if="side === 'supplier'" :order="order" :side="side" />
    </li>
  </ul>
</template>
