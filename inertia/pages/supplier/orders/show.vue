<script setup lang="ts">
import OrderDetail from '~/components/orders/order_detail.vue'
import type { OrderType } from '#shared/types/order'

defineProps<{ order: OrderType }>()
</script>

<template>
  <OrderDetail :order="order" side="supplier" />
</template>
