<script setup lang="ts">
import { computed } from 'vue'
import type { ProductType } from '#shared/types/product'

const props = defineProps<{ product: ProductType }>()

const price = computed(() => {
  const { priceMin, priceMax, currency } = props.product
  if (!priceMin && !priceMax) return null
  const min = priceMin ? `${priceMin} ${currency}` : null
  if (priceMin && priceMax && priceMin !== priceMax) return `${priceMin} – ${priceMax} ${currency}`
  return min ?? `${priceMax} ${currency}`
})
</script>

<template>
  <div class="flex flex-col gap-2 rounded border border-[var(--gray-3)] p-4">
    <img
      v-if="product.imageUrl"
      :src="product.imageUrl"
      :alt="product.name ?? product.slug"
      class="aspect-square w-full rounded object-cover"
    />
    <h4 class="font-medium">{{ product.name ?? product.slug }}</h4>
    <span v-if="price" class="text-sm text-[var(--gray-6)]">{{ price }}</span>
  </div>
</template>
