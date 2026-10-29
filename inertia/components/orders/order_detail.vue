<script setup lang="ts">
import { computed, watch } from 'vue'
import { Head, router, usePage } from '@inertiajs/vue3'
import { Building2, FileText } from 'lucide-vue-next'
import type { Data } from '@generated/data'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
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

const indexUrl = computed(() =>
  urlFor(props.side === 'buyer' ? 'orders.index' : 'supplier.orders.index', {
    locale: locale.value,
  })
)

watch(
  () => page.props.unreadNotificationsCount,
  () => router.reload({ only: ['order'] })
)
</script>

<template>
  <Head :title="t('order.show.title', { id: order.id })" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('order.show.title', { id: order.id })"
      :back-href="indexUrl"
      :back-label="t('order.show.backToList')"
    >
      <template #meta>
        <BaseBadge dot :tone="ORDER_STATUS_TONES[order.status]">
          {{ t(`order.status.${order.status}`) }}
        </BaseBadge>
        <span
          class="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-card px-3 py-1 text-caption text-text-secondary"
        >
          <FileText :size="14" aria-hidden="true" />
          {{ t('order.show.forRfq', { rfqTitle: order.rfqTitle }) }}
        </span>
        <span
          class="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-card px-3 py-1 text-caption text-text-secondary"
        >
          <Building2 :size="14" aria-hidden="true" />
          {{ side === 'buyer' ? t('order.show.supplier') : t('order.show.buyer') }} :
          {{ side === 'buyer' ? order.supplierName : order.buyerName }}
        </span>
      </template>
      <template v-if="order.actions.length > 0" #actions>
        <OrderActions :order="order" :side="side" />
      </template>
    </BasePageHeader>

    <div class="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div class="flex flex-col gap-8">
        <BaseSection :title="t('order.show.items')" flush>
          <OrderItemsTable :order="order" />
        </BaseSection>

        <div class="grid gap-8 sm:grid-cols-2">
          <OrderAddress :title="t('order.show.shippingAddress')" :address="order.shippingAddress" />
          <OrderAddress :title="t('order.show.billingAddress')" :address="order.billingAddress" />
        </div>
      </div>

      <BaseSection :title="t('order.show.timeline')">
        <OrderTimeline :timeline="order.timeline" />
      </BaseSection>
    </div>
  </div>
</template>
