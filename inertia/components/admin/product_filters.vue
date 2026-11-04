<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import {
  ADMIN_PRODUCT_QUALITY_FILTERS,
  ADMIN_PRODUCT_VISIBILITY_FILTERS,
  type AdminProductFilterOptions,
  type AdminProductIndexFilters,
} from '#shared/types/admin_product'

/**
 * Filtres de la liste des produits : recherche, fournisseur, catégorie (options
 * indentées selon la profondeur), visibilité et qualité. Envoyés au clic sur
 * « Filtrer » via `change` ; la page relance la visite Inertia.
 */
const props = defineProps<{
  filters: AdminProductIndexFilters
  options: AdminProductFilterOptions
}>()
const emit = defineEmits<{ change: [filters: AdminProductIndexFilters] }>()

const { t } = useI18n()

const fromProps = () => ({
  search: props.filters.search ?? '',
  supplierId: props.filters.supplierId === null ? '' : String(props.filters.supplierId),
  categoryId: props.filters.categoryId === null ? '' : String(props.filters.categoryId),
  visibility: props.filters.visibility ?? '',
  quality: props.filters.quality ?? '',
})

const model = reactive(fromProps())

// Les filtres du serveur font foi : retour arrière, lien externe ou pagination.
watch(
  () => props.filters,
  () => Object.assign(model, fromProps()),
  { deep: true }
)

const indent = (depth: number) => '  '.repeat(depth)

function submit() {
  emit('change', {
    search: model.search.trim() || null,
    supplierId: model.supplierId ? Number(model.supplierId) : null,
    categoryId: model.categoryId ? Number(model.categoryId) : null,
    visibility: (model.visibility || null) as AdminProductIndexFilters['visibility'],
    quality: (model.quality || null) as AdminProductIndexFilters['quality'],
  })
}

function reset() {
  Object.assign(model, { search: '', supplierId: '', categoryId: '', visibility: '', quality: '' })
  submit()
}
</script>

<template>
  <BaseCard padding="md">
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BaseInput
          id="product-search"
          v-model="model.search"
          type="search"
          :label="t('admin.products.filters.search')"
          :placeholder="t('admin.products.filters.searchPlaceholder')"
        >
          <template #prefix><Search :size="16" aria-hidden="true" /></template>
        </BaseInput>
        <BaseSelect
          id="product-supplier"
          v-model="model.supplierId"
          :label="t('admin.products.filters.supplier')"
        >
          <option value="">{{ t('admin.products.filters.allSuppliers') }}</option>
          <option v-for="supplier in options.suppliers" :key="supplier.id" :value="supplier.id">
            {{ supplier.name }}
          </option>
        </BaseSelect>
        <BaseSelect
          id="product-category"
          v-model="model.categoryId"
          :label="t('admin.products.filters.category')"
        >
          <option value="">{{ t('admin.products.filters.allCategories') }}</option>
          <option v-for="category in options.categories" :key="category.id" :value="category.id">
            {{ indent(category.depth) }}{{ category.name }}
          </option>
        </BaseSelect>
        <BaseSelect
          id="product-visibility"
          v-model="model.visibility"
          :label="t('admin.products.filters.visibility')"
        >
          <option value="">{{ t('admin.products.filters.allVisibility') }}</option>
          <option v-for="value in ADMIN_PRODUCT_VISIBILITY_FILTERS" :key="value" :value="value">
            {{ t(`admin.products.visibility.${value}`) }}
          </option>
        </BaseSelect>
        <BaseSelect
          id="product-quality"
          v-model="model.quality"
          :label="t('admin.products.filters.quality')"
        >
          <option value="">{{ t('admin.products.filters.allQuality') }}</option>
          <option v-for="value in ADMIN_PRODUCT_QUALITY_FILTERS" :key="value" :value="value">
            {{ t(`admin.products.quality.${value}`) }}
          </option>
        </BaseSelect>
      </div>
      <div class="flex justify-end gap-3">
        <BaseButton variant="secondary" size="sm" @click="reset">
          {{ t('admin.trade.filters.reset') }}
        </BaseButton>
        <BaseButton type="submit" size="sm">{{ t('admin.trade.filters.apply') }}</BaseButton>
      </div>
    </form>
  </BaseCard>
</template>
