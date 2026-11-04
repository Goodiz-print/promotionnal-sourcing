<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { useProductListVisit } from '~/composables/use_product_list_visit'
import ProductFilters from '~/components/admin/product_filters.vue'
import ProductList from '~/components/admin/product_list.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import type {
  AdminProductFilterOptions,
  AdminProductIndexFilters,
  AdminProductListItem,
} from '#shared/types/admin_product'
import type { Paginated } from '#shared/types/pagination'

// `canManage` est exposé par le serveur ; les actions vivent sur la fiche produit.
const props = defineProps<{
  productList: Paginated<AdminProductListItem>
  filters: AdminProductIndexFilters
  filterOptions: AdminProductFilterOptions
  canManage: boolean
}>()

const { t } = useI18n()
const { visit } = useProductListVisit()
</script>

<template>
  <Head :title="t('admin.products.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('admin.products.title')"
      :description="t('admin.products.subtitle')"
    />

    <ProductFilters :filters="filters" :options="filterOptions" @change="visit" />

    <ProductList :products="productList" @page="(page) => visit(props.filters, page)" />
  </div>
</template>
