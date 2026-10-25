<script setup lang="ts">
import { watch } from 'vue'
import { Head, router, usePage } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import type { Data } from '@generated/data'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import OrderActions from '~/components/orders/order_actions.vue'
import OrderAddress from '~/components/orders/order_address.vue'
import OrderItemsTable from '~/components/orders/order_items_table.vue'
import OrderTimeline from '~/components/orders/order_timeline.vue'
import { ORDER_STATUS_TONES } from '~/components/orders/types'
import type { OrderSide, OrderType } from '#shared/types/order'

/**
 * Détail d'une commande, commun aux deux côtés : en-tête, frise de suivi,
 * adresses, lignes et actions ouvertes. La frise suit l'avancement « en temps
 * réel » : une notification reçue (flux Transmit, voir `useNotificationStream`)
 * fait monter le compteur de non-lues, ce qui recharge la commande seule.
 */
const props = defineProps<{ order: OrderType; side: OrderSide }>()

const { t, locale } = useI18n()
const page = usePage<Data.SharedProps>()

watch(
  () => page.props.unreadNotificationsCount,
  () => router.reload({ only: ['order'] })
)
</script>

<template>
  <Head :title="t('order.show.title', { id: order.id })" />

  <div class="mx-auto flex max-w-[860px] flex-col gap-8 px-6 py-12">
    <div>
      <Link
        :route="side === 'buyer' ? 'orders.index' : 'supplier.orders.index'"
        :params="{ locale }"
        class="text-sm text-[var(--color-primary)] hover:underline"
      >
        {{ t('order.show.backToList') }}
      </Link>

      <div class="mt-3 flex items-start justify-between gap-4">
        <h1 class="text-[32px] tracking-[-0.5px]">{{ t('order.show.title', { id: order.id }) }}</h1>
        <BaseBadge :tone="ORDER_STATUS_TONES[order.status]">
          {{ t(`order.status.${order.status}`) }}
        </BaseBadge>
      </div>
      <p class="mt-1 text-sm text-[var(--gray-6)]">
        {{ t('order.show.forRfq', { rfqTitle: order.rfqTitle }) }}
      </p>
      <p class="mt-1 text-sm text-[var(--gray-6)]">
        {{ side === 'buyer' ? t('order.show.supplier') : t('order.show.buyer') }} :
        {{ side === 'buyer' ? order.supplierName : order.buyerName }}
      </p>
    </div>

    <OrderActions :order="order" :side="side" />

    <section class="flex flex-col gap-3">
      <h2 class="font-medium">{{ t('order.show.timeline') }}</h2>
      <OrderTimeline :timeline="order.timeline" />
    </section>

    <OrderItemsTable :order="order" />

    <div class="grid gap-6 sm:grid-cols-2">
      <OrderAddress :title="t('order.show.shippingAddress')" :address="order.shippingAddress" />
      <OrderAddress :title="t('order.show.billingAddress')" :address="order.billingAddress" />
    </div>
  </div>
</template>
