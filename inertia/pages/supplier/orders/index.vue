<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import OrderList from '~/components/orders/order_list.vue'
import type { OrderType } from '#shared/types/order'

defineProps<{ orders: OrderType[] }>()

const { t } = useI18n()
</script>

<template>
  <Head :title="t('order.supplier.index.title')" />

  <div class="mx-auto flex max-w-[960px] flex-col gap-6 px-6 py-12">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('order.supplier.index.title') }}</h1>
      <p class="text-lg text-[var(--gray-6)]">{{ t('order.supplier.index.subtitle') }}</p>
    </div>

    <OrderList :orders="orders" side="supplier" empty-key="order.supplier.index.empty" />
  </div>
</template>
