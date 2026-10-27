<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import FacetGroup from '~/components/catalogue/facet_group.vue'
import CertificationFacet from '~/components/catalogue/certification_facet.vue'
import type { CategoryType, CategoryFacetBarType } from '#shared/types/category'
import type { CertificationFacetBarType } from '#shared/types/certification'
import { ORIGIN_ZONES, type OriginZone, type ProductDirectoryFilters } from '#shared/types/product'

const props = defineProps<{
  filters: ProductDirectoryFilters
  categories: CategoryType[]
  facetBar: CategoryFacetBarType
  certificationFacet: CertificationFacetBarType
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
  certificationIds: [...props.filters.certificationIds],
  originZones: [...props.filters.originZones],
  newOnly: props.filters.newOnly,
  ecoOnly: props.filters.ecoOnly,
})

// Zones de provenance à 3 états (écart 9) : France / Europe / Hors Europe.
const ORIGIN_ZONE_OPTIONS = ORIGIN_ZONES

function apply() {
  emit('apply', {
    search: state.search,
    categoryId: state.categoryId,
    madeInEurope: state.madeInEurope,
    attributeValueIds: [...state.attributeValueIds],
    certificationIds: [...state.certificationIds],
    originZones: [...state.originZones],
    newOnly: state.newOnly,
    ecoOnly: state.ecoOnly,
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

function toggleOriginZone(zone: OriginZone, checked: boolean) {
  state.originZones = checked
    ? [...state.originZones, zone]
    : state.originZones.filter((value) => value !== zone)
  apply()
}

function onNewOnly(value: boolean) {
  state.newOnly = value
  apply()
}

function onEcoOnly(value: boolean) {
  state.ecoOnly = value
  apply()
}

function toggleValue(valueId: number, checked: boolean) {
  state.attributeValueIds = checked
    ? [...state.attributeValueIds, valueId]
    : state.attributeValueIds.filter((id) => id !== valueId)
  apply()
}

function toggleCertification(certificationId: number, checked: boolean) {
  state.certificationIds = checked
    ? [...state.certificationIds, certificationId]
    : state.certificationIds.filter((id) => id !== certificationId)
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

    <BaseCheckbox
      id="newOnly"
      :model-value="state.newOnly"
      :label="t('products.index.newOnly')"
      @update:model-value="onNewOnly"
    />

    <BaseCheckbox
      id="ecoOnly"
      :model-value="state.ecoOnly"
      :label="t('products.index.ecoOnly')"
      @update:model-value="onEcoOnly"
    />

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1 text-sm font-medium">{{ t('products.index.origin.title') }}</legend>
      <BaseCheckbox
        v-for="zone in ORIGIN_ZONE_OPTIONS"
        :id="`origin-${zone}`"
        :key="zone"
        :model-value="state.originZones.includes(zone)"
        :label="t(`products.index.origin.${zone}`)"
        @update:model-value="(checked: boolean) => toggleOriginZone(zone, checked)"
      />
    </fieldset>

    <!-- Labels de conformité (écart 4, ÉTAPE 6) : facette transverse aux
         catégories, donc toujours affichée (indépendante de la sélection). -->
    <CertificationFacet
      :facet="certificationFacet"
      :selected-ids="state.certificationIds"
      @toggle="toggleCertification"
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
