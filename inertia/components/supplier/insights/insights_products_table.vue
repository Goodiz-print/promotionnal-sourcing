<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'
import { Package } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { Paginated } from '#shared/types/pagination'
import type { SupplierInsightsProductRow } from '#shared/types/supplier_insights'

/**
 * Consultations par produit (#239) : tous les produits du fournisseur, les plus
 * consultés en tête. Visible de tous les fournisseurs, abonnés ou non.
 */
defineProps<{ products: Paginated<SupplierInsightsProductRow> }>()
defineEmits<{ page: [page: number] }>()

const { t, locale } = useI18n()
</script>

<template>
  <BaseSection flush :title="t('supplier.insights.products.title')">
    <div v-if="products.meta.total === 0" class="p-6">
      <BaseEmptyState
        compact
        :icon="Package"
        :title="t('supplier.insights.products.emptyTitle')"
        :description="t('supplier.insights.products.emptyBody')"
      />
    </div>

    <template v-else>
      <BaseTable bare :caption="t('supplier.insights.products.title')">
        <template #head>
          <tr>
            <th scope="col">{{ t('supplier.insights.products.columns.product') }}</th>
            <th scope="col" class="text-right">
              {{ t('supplier.insights.products.columns.views') }}
            </th>
            <th scope="col" class="text-right">
              {{ t('supplier.insights.products.columns.rfqAdditions') }}
            </th>
          </tr>
        </template>

        <tr v-for="product in products.data" :key="product.productId">
          <td>
            <Link
              route="supplier.products.edit"
              :params="{ locale, id: product.productId }"
              class="font-semibold text-text-primary hover:text-indigo-600"
            >
              {{ product.name }}
            </Link>
          </td>
          <td class="text-tabular text-right">{{ product.views }}</td>
          <td class="text-tabular text-right">{{ product.rfqAdditions }}</td>
        </tr>
      </BaseTable>

      <div v-if="products.meta.lastPage > 1" class="border-t border-hairline px-6 py-4">
        <BasePagination
          :meta="products.meta"
          :previous-label="t('supplier.insights.products.previous')"
          :next-label="t('supplier.insights.products.next')"
          @change="(page) => $emit('page', page)"
        />
      </div>
    </template>
  </BaseSection>
</template>
