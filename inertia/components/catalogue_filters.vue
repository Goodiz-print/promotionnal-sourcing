<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import BaseButton from '~/components/base/base_button.vue'
import FacetSection from '~/components/catalogue/facet_section.vue'
import FacetGroup from '~/components/catalogue/facet_group.vue'
import CertificationFacet from '~/components/catalogue/certification_facet.vue'
import NumericFacetGroup from '~/components/catalogue/numeric_facet_group.vue'
import EnumFacetGroup from '~/components/catalogue/enum_facet_group.vue'
import { CATALOGUE_FLAGS, useCatalogueFilters } from '~/composables/use_catalogue_filters'
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

// Copie locale des filtres pilotée par le composable : la barre remonte l'état
// complet au parent via `apply` (recherche debouncée, reste immédiat).
const {
  state,
  hasActiveFilters,
  onSearch,
  onCategory,
  setFlag,
  toggleOriginZone,
  toggleStockStatus,
  toggleValue,
  toggleCertification,
  toggleBucket,
  toggleAttributeRange,
  reset,
} = useCatalogueFilters(props.filters, (filters) => emit('apply', filters))
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-eyebrow text-text-muted">{{ t('products.index.filtersTitle') }}</h2>
      <BaseButton v-if="hasActiveFilters" variant="link" class="text-body-sm" @click="reset">
        {{ t('products.index.reset') }}
      </BaseButton>
    </div>

    <BaseInput
      id="search"
      :model-value="state.search"
      type="search"
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

    <!-- Interrupteurs booléens transverses (made-in-Europe, nouveautés, éco). -->
    <FacetSection :title="t('products.index.quickFilters')">
      <BaseCheckbox
        v-for="flag in CATALOGUE_FLAGS"
        :id="flag"
        :key="flag"
        :model-value="state[flag]"
        :label="t(`products.index.${flag}`)"
        @update:model-value="(checked: boolean) => setFlag(flag, checked)"
      />
    </FacetSection>

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

    <p
      v-if="state.categoryId === null"
      class="border-t border-hairline pt-5 text-body-sm text-text-muted"
    >
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
