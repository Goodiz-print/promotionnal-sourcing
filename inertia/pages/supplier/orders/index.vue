<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import BasePageHeader from '~/components/base/base_page_header.vue'
import OrderList from '~/components/orders/order_list.vue'
import type { OrderType } from '#shared/types/order'

defineProps<{ orders: OrderType[] }>()

const { t } = useI18n()
</script>

<template>
  <Head :title="t('order.supplier.index.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('order.supplier.index.title')"
      :description="t('order.supplier.index.subtitle')"
    />

    <OrderList :orders="orders" side="supplier" empty-key="order.supplier.index.empty" />
  </div>
</template>
