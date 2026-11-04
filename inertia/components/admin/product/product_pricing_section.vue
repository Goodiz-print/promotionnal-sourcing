<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminProductPriceTier, AdminProductVariant } from '#shared/types/admin_product'

/** Paliers de prix dégressifs ; chaque palier vise une variante ou toutes. */
const props = defineProps<{ tiers: AdminProductPriceTier[]; variants: AdminProductVariant[] }>()

const { t } = useI18n()

const variantLabel = (variantId: number | null) =>
  props.variants.find((variant) => variant.id === variantId)?.sku ??
  t('admin.products.detail.allVariants')
</script>

<template>
  <BaseSection :title="t('admin.products.detail.pricing')" flush>
    <p v-if="tiers.length === 0" class="px-6 py-4 text-body-sm text-text-secondary">
      {{ t('admin.products.detail.noPricing') }}
    </p>
    <BaseTable v-else bare :caption="t('admin.products.detail.pricing')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.products.detail.appliesTo') }}</th>
          <th scope="col" class="text-right">{{ t('admin.products.detail.minQuantity') }}</th>
          <th scope="col" class="text-right">{{ t('admin.products.detail.unitPrice') }}</th>
        </tr>
      </template>
      <tr v-for="tier in tiers" :key="tier.id">
        <td>{{ variantLabel(tier.variantId) }}</td>
        <td class="text-tabular text-right">{{ tier.minQuantity }}</td>
        <td class="text-tabular text-right">{{ tier.unitPrice }} {{ tier.currency }}</td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
