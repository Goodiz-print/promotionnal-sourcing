<script setup lang="ts">
import { Package } from 'lucide-vue-next'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import ProductVisibilityBadge from '~/components/admin/product_visibility_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminProductListItem } from '#shared/types/admin_product'
import type { Paginated } from '#shared/types/pagination'

/** Tableau paginé des produits : lien vers la fiche, fournisseur, visibilité, stock. */
defineProps<{ products: Paginated<AdminProductListItem> }>()
const emit = defineEmits<{ page: [page: number] }>()

const { t, locale } = useI18n()

const showUrl = (product: AdminProductListItem) =>
  urlFor('admin.products.show', { locale: locale.value, id: product.id })

const formatDate = (value: string) => new Date(value).toLocaleDateString(locale.value)
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-tabular text-body-sm text-text-secondary">
      {{ t('admin.products.resultsCount', { count: products.meta.total }) }}
    </p>

    <BaseEmptyState
      v-if="products.data.length === 0"
      :title="t('admin.products.empty')"
      :description="t('admin.products.emptyDescription')"
      :icon="Package"
    />

    <BaseTable v-else :caption="t('admin.products.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.products.columns.name') }}</th>
          <th scope="col">{{ t('admin.products.columns.supplier') }}</th>
          <th scope="col">{{ t('admin.products.columns.category') }}</th>
          <th scope="col">{{ t('admin.products.columns.visibility') }}</th>
          <th scope="col" class="text-right">{{ t('admin.products.columns.variants') }}</th>
          <th scope="col" class="text-right">{{ t('admin.products.columns.images') }}</th>
          <th scope="col">{{ t('admin.products.columns.stock') }}</th>
          <th scope="col">{{ t('admin.products.columns.createdAt') }}</th>
        </tr>
      </template>

      <tr v-for="product in products.data" :key="product.id">
        <td>
          <Link
            :href="showUrl(product)"
            class="font-semibold text-text-primary hover:text-indigo-600"
          >
            {{ product.name ?? product.slug }}
          </Link>
        </td>
        <td class="text-text-secondary">{{ product.supplierName }}</td>
        <td class="text-text-secondary">{{ product.categoryName }}</td>
        <td><ProductVisibilityBadge :status="product.visibilityStatus" /></td>
        <td class="text-tabular text-right">{{ product.variantsCount }}</td>
        <td class="text-tabular text-right">{{ product.imagesCount }}</td>
        <td class="text-text-secondary">
          <template v-if="product.stockStatus">
            {{ t(`admin.products.stockStatus.${product.stockStatus}`) }}
          </template>
        </td>
        <td class="text-tabular whitespace-nowrap">{{ formatDate(product.createdAt) }}</td>
      </tr>
    </BaseTable>

    <BasePagination
      :meta="products.meta"
      :previous-label="t('admin.pagination.previous')"
      :next-label="t('admin.pagination.next')"
      @change="(page) => emit('page', page)"
    />
  </div>
</template>
