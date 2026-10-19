<script setup lang="ts">
import { useI18n } from '~/i18n'
import type { ProductPriceTierType } from '#shared/types/product'

defineProps<{ tiers: ProductPriceTierType[] }>()

const { t } = useI18n()
</script>

<template>
  <table class="w-full text-sm">
    <caption class="mb-1 text-left font-medium">
      {{
        t('products.show.priceTiers')
      }}
    </caption>
    <thead class="text-left text-[var(--gray-6)]">
      <tr>
        <th scope="col" class="py-1 font-normal">{{ t('products.show.tierQuantity') }}</th>
        <th scope="col" class="py-1 text-right font-normal">{{ t('products.show.tierPrice') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="tier in tiers" :key="tier.id" class="border-t border-[var(--gray-3)]">
        <td class="py-1">{{ t('products.show.tierFrom', { quantity: tier.minQuantity }) }}</td>
        <td class="py-1 text-right">{{ Number(tier.unitPrice) }} {{ tier.currency }}</td>
      </tr>
    </tbody>
  </table>
</template>
