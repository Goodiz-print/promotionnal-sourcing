<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseTable from '~/components/base/base_table.vue'
import type { ProductPriceTierType } from '#shared/types/product'

/** Grille de prix dégressive d'un produit (ou d'une variante). Conçue pour une `BaseSection flush`. */
defineProps<{ tiers: ProductPriceTierType[] }>()

const { t } = useI18n()
</script>

<template>
  <BaseTable bare :caption="t('products.show.priceTiers')">
    <template #head>
      <tr>
        <th scope="col">{{ t('products.show.tierQuantity') }}</th>
        <th scope="col" class="text-right">{{ t('products.show.tierPrice') }}</th>
      </tr>
    </template>
    <tr v-for="tier in tiers" :key="tier.id">
      <td class="text-tabular">
        {{ t('products.show.tierFrom', { quantity: tier.minQuantity }) }}
      </td>
      <td class="text-tabular text-right font-semibold text-indigo-600">
        {{ Number(tier.unitPrice) }} {{ tier.currency }}
      </td>
    </tr>
  </BaseTable>
</template>
