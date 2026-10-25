<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import FacetGroup from '~/components/catalogue/facet_group.vue'
import type { CategoryType, CategoryFacetBarType } from '#shared/types/category'
import type { ProductDirectoryFilters } from '#shared/types/product'

const props = defineProps<{
  filters: ProductDirectoryFilters
  categories: CategoryType[]
  facetBar: CategoryFacetBarType
}>()

const emit = defineEmits<{
  apply: [filters: ProductDirectoryFilters]
}>()

const { t } = useI18n()

// Copie locale des filtres : la barre est pilotée localement puis remonte
// l'état complet au parent via `apply` (recherche debouncée, reste immédiat).
const state = reactive<ProductDirectoryFilters>({
  search: props.filters.search,
  categoryId: props.filters.categoryId,
  madeInEurope: props.filters.madeInEurope,
  attributeValueIds: [...props.filters.attributeValueIds],
})

function apply() {
  emit('apply', {
    search: state.search,
    categoryId: state.categoryId,
    madeInEurope: state.madeInEurope,
    attributeValueIds: [...state.attributeValueIds],
  })
}

let debounce: ReturnType<typeof setTimeout>
function onSearch(value: string | null) {
  state.search = value || null
  clearTimeout(debounce)
  debounce = setTimeout(apply, 300)
}

function onCategory(value: string | null) {
  state.categoryId = value ? Number(value) : null
  // Les facettes dépendent de la catégorie : on repart d'une sélection vide pour
  // ne pas garder des valeurs qui n'appartiennent pas à la nouvelle catégorie.
  state.attributeValueIds = []
  apply()
}

function onMadeInEurope(value: boolean) {
  state.madeInEurope = value
  apply()
}

function toggleValue(valueId: number, checked: boolean) {
  state.attributeValueIds = checked
    ? [...state.attributeValueIds, valueId]
    : state.attributeValueIds.filter((id) => id !== valueId)
  apply()
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <BaseInput
      id="search"
      :model-value="state.search"
      type="text"
      :label="t('products.index.searchLabel')"
      :placeholder="t('products.index.searchPlaceholder')"
      @update:model-value="onSearch"
    />

    <BaseSelect
      id="category"
      :model-value="state.categoryId === null ? '' : String(state.categoryId)"
      :label="t('products.index.category')"
      @update:model-value="onCategory"
    >
      <option value="">{{ t('products.index.allCategories') }}</option>
      <option v-for="category in categories" :key="category.id" :value="String(category.id)">
        {{ category.name ?? category.slug }}
      </option>
    </BaseSelect>

    <BaseCheckbox
      id="madeInEurope"
      :model-value="state.madeInEurope"
      :label="t('products.index.madeInEurope')"
      @update:model-value="onMadeInEurope"
    />

    <p v-if="state.categoryId === null" class="text-sm text-[var(--gray-6)]">
      {{ t('products.index.selectCategoryForFilters') }}
    </p>

    <FacetGroup
      v-for="attribute in facetBar.attributes"
      :key="attribute.attributeId"
      :attribute="attribute"
      :selected-ids="state.attributeValueIds"
      :has-counts="facetBar.hasCounts"
      @toggle="toggleValue"
    />
  </div>
</template>
