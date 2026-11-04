<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminProductVariant } from '#shared/types/admin_product'

/** Variantes du produit : SKU, état et statut de stock. */
defineProps<{ variants: AdminProductVariant[] }>()

const { t } = useI18n()
</script>

<template>
  <BaseSection :title="t('admin.products.detail.variants')" flush>
    <p v-if="variants.length === 0" class="px-6 py-4 text-body-sm text-text-secondary">
      {{ t('admin.products.detail.noVariants') }}
    </p>
    <BaseTable v-else bare :caption="t('admin.products.detail.variants')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.products.detail.sku') }}</th>
          <th scope="col">{{ t('admin.products.columns.stock') }}</th>
          <th scope="col">{{ t('admin.products.columns.visibility') }}</th>
        </tr>
      </template>
      <tr v-for="variant in variants" :key="variant.id">
        <td class="font-semibold">{{ variant.sku }}</td>
        <td class="text-text-secondary">
          <template v-if="variant.stockStatus">
            {{ t(`admin.products.stockStatus.${variant.stockStatus}`) }}
          </template>
        </td>
        <td>
          <BaseBadge dot :tone="variant.isActive ? 'success' : 'neutral'">
            {{
              t(
                variant.isActive
                  ? 'admin.products.detail.variantActive'
                  : 'admin.products.detail.variantInactive'
              )
            }}
          </BaseBadge>
        </td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
