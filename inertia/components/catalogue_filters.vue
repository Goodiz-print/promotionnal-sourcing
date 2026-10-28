<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import FacetGroup from '~/components/catalogue/facet_group.vue'
import CertificationFacet from '~/components/catalogue/certification_facet.vue'
import NumericFacetGroup from '~/components/catalogue/numeric_facet_group.vue'
import EnumFacetGroup from '~/components/catalogue/enum_facet_group.vue'
import type { CategoryType, CategoryFacetBarType } from '#shared/types/category'
import type { CertificationFacetBarType } from '#shared/types/certification'
import {
  ORIGIN_ZONES,
  PRODUCT_STOCK_STATUSES,
  type OriginZone,
  type ProductStockStatus,
  type CatalogueNumericFacetsType,
  type ProductDirectoryFilters,
} from '#shared/types/product'

const props = defineProps<{
  filters: ProductDirectoryFilters
  categories: CategoryType[]
  facetBar: CategoryFacetBarType
  certificationFacet: CertificationFacetBarType
  numericFacets: CatalogueNumericFacetsType
}>()

const emit = defineEmits<{
  apply: [filters: ProductDirectoryFilters]
}>()

const { t } = useI18n()

const originLabel = (zone: OriginZone) => t(`products.index.origin.${zone}`)
const stockLabel = (status: ProductStockStatus) => t(`products.index.stock.${status}`)

// Copie locale des filtres : la barre est pilotée localement puis remonte
// l'état complet au parent via `apply` (recherche debouncée, reste immédiat).
const state = reactive<ProductDirectoryFilters>({
  search: props.filters.search,
  categoryId: props.filters.categoryId,
  madeInEurope: props.filters.madeInEurope,
  attributeValueIds: [...props.filters.attributeValueIds],
  certificationIds: [...props.filters.certificationIds],
  originZones: [...props.filters.originZones],
  stockStatuses: [...props.filters.stockStatuses],
  priceBuckets: [...props.filters.priceBuckets],
  moqBuckets: [...props.filters.moqBuckets],
  attributeRanges: props.filters.attributeRanges.map((range) => ({ ...range })),
  newOnly: props.filters.newOnly,
  ecoOnly: props.filters.ecoOnly,
})

function apply() {
  emit('apply', {
    search: state.search,
    categoryId: state.categoryId,
    madeInEurope: state.madeInEurope,
    attributeValueIds: [...state.attributeValueIds],
    certificationIds: [...state.certificationIds],
    originZones: [...state.originZones],
    stockStatuses: [...state.stockStatuses],
    priceBuckets: [...state.priceBuckets],
    moqBuckets: [...state.moqBuckets],
    attributeRanges: state.attributeRanges.map((range) => ({ ...range })),
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
  // ne pas garder des valeurs/tranches qui n'appartiennent pas à la nouvelle catégorie.
  state.attributeValueIds = []
  state.attributeRanges = []
  apply()
}

// Interrupteurs booléens transverses (made-in-Europe, nouveautés, éco).
function setFlag(key: 'madeInEurope' | 'newOnly' | 'ecoOnly', value: boolean) {
  state[key] = value
  apply()
}

function toggleOriginZone(zone: OriginZone, checked: boolean) {
  state.originZones = checked
    ? [...state.originZones, zone]
    : state.originZones.filter((value) => value !== zone)
  apply()
}

function toggleStockStatus(status: ProductStockStatus, checked: boolean) {
  state.stockStatuses = checked
    ? [...state.stockStatuses, status]
    : state.stockStatuses.filter((value) => value !== status)
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

// Buckets prix / MOQ (plan L125) : liste d'index cochés dans la liste fermée partagée.
function toggleBucket(key: 'priceBuckets' | 'moqBuckets', index: number, checked: boolean) {
  state[key] = checked ? [...state[key], index] : state[key].filter((value) => value !== index)
  apply()
}

// Tranche d'attribut EAV (plan L125) : identifiée par slug + bornes `[min, max[`.
function toggleAttributeRange(
  slug: string,
  minValue: number | null,
  maxValue: number | null,
  checked: boolean
) {
  state.attributeRanges = checked
    ? [...state.attributeRanges, { slug, minValue, maxValue }]
    : state.attributeRanges.filter(
        (range) =>
          !(range.slug === slug && range.minValue === minValue && range.maxValue === maxValue)
      )
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
      @update:model-value="(v: boolean) => setFlag('madeInEurope', v)"
    />

    <BaseCheckbox
      id="newOnly"
      :model-value="state.newOnly"
      :label="t('products.index.newOnly')"
      @update:model-value="(v: boolean) => setFlag('newOnly', v)"
    />

    <BaseCheckbox
      id="ecoOnly"
      :model-value="state.ecoOnly"
      :label="t('products.index.ecoOnly')"
      @update:model-value="(v: boolean) => setFlag('ecoOnly', v)"
    />

    <!-- Provenance (écart 9) et stock (plan L98) : facettes d'énumération transverses. -->
    <EnumFacetGroup
      :title="t('products.index.origin.title')"
      :options="ORIGIN_ZONES"
      :selected="state.originZones"
      :label-for="originLabel"
      id-prefix="origin"
      @toggle="toggleOriginZone"
    />
    <EnumFacetGroup
      :title="t('products.index.stock.title')"
      :options="PRODUCT_STOCK_STATUSES"
      :selected="state.stockStatuses"
      :label-for="stockLabel"
      id-prefix="stock"
      @toggle="toggleStockStatus"
    />

    <!-- Prix & MOQ (plan L125) : facettes transverses à buckets, toujours affichées. -->
    <NumericFacetGroup
      :title="t('products.index.price.title')"
      id-prefix="price"
      :facet="numericFacets.price"
      :selected-indices="state.priceBuckets"
      :suffix="t('products.index.price.currency')"
      @toggle="(index, checked) => toggleBucket('priceBuckets', index, checked)"
    />
    <NumericFacetGroup
      :title="t('products.index.moq.title')"
      id-prefix="moq"
      :facet="numericFacets.moq"
      :selected-indices="state.moqBuckets"
      @toggle="(index, checked) => toggleBucket('moqBuckets', index, checked)"
    />

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
      :selected-ranges="state.attributeRanges"
      :has-counts="facetBar.hasCounts"
      @toggle="toggleValue"
      @toggle-range="toggleAttributeRange"
    />
  </div>
</template>
