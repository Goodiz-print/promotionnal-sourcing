<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { PackageSearch } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import ProductCard from '~/components/product_card.vue'
import ProductCardSkeleton from '~/components/product_card_skeleton.vue'
import { useVisitLoading } from '~/composables/use_visit_loading'
import CatalogueFilters from '~/components/catalogue_filters.vue'
import type { Paginated } from '#shared/types/pagination'
import type { CategoryType, CategoryFacetBarType } from '#shared/types/category'
import type { CertificationFacetBarType } from '#shared/types/certification'
import type {
  ProductType,
  ProductDirectoryFilters,
  CatalogueNumericFacetsType,
  CatalogueEnumFacetsType,
} from '#shared/types/product'

defineProps<{
  products: Paginated<ProductType>
  searchUnavailable: boolean
  filters: ProductDirectoryFilters
  categories: CategoryType[]
  facetBar: CategoryFacetBarType
  certificationFacet: CertificationFacetBarType
  numericFacets: CatalogueNumericFacetsType
  enumFacets?: CatalogueEnumFacetsType
}>()

const { t, locale } = useI18n()
const { loading } = useVisitLoading()

function visit(filters: ProductDirectoryFilters, page = 1) {
  router.get(
    urlFor('products.index', { locale: locale.value }),
    {
      search: filters.search || undefined,
      categoryId: filters.categoryId ?? undefined,
      madeInEurope: filters.madeInEurope ? 'true' : undefined,
      attributeValueIds: filters.attributeValueIds.length ? filters.attributeValueIds : undefined,
      certificationIds: filters.certificationIds.length ? filters.certificationIds : undefined,
      originZones: filters.originZones.length ? filters.originZones : undefined,
      stockStatuses: filters.stockStatuses.length ? filters.stockStatuses : undefined,
      // Tranches numériques (plan L125) : buckets par index, tranches EAV encodées
      // `slug:min:max` (borne vide = ouverte).
      priceBuckets: filters.priceBuckets.length ? filters.priceBuckets : undefined,
      moqBuckets: filters.moqBuckets.length ? filters.moqBuckets : undefined,
      attributeRanges: filters.attributeRanges.length
        ? filters.attributeRanges.map(
            (range) => `${range.slug}:${range.minValue ?? ''}:${range.maxValue ?? ''}`
          )
        : undefined,
      newOnly: filters.newOnly ? 'true' : undefined,
      ecoOnly: filters.ecoOnly ? 'true' : undefined,
      page,
    },
    {
      preserveState: true,
      preserveScroll: true,
      // `facetBar`, `certificationFacet` et `numericFacets` sont rechargés aussi :
      // attributs filtrables, labels, buckets prix/MOQ et leurs compteurs dépendent
      // de la catégorie et des filtres de navigation.
      only: [
        'products',
        'filters',
        'searchUnavailable',
        'facetBar',
        'certificationFacet',
        'numericFacets',
        'enumFacets',
      ],
    }
  )
}
</script>

<template>
  <Head :title="t('products.index.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('products.index.title')"
      :description="t('products.index.subtitle')"
    />

    <div class="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside class="self-start lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <BaseCard padding="md">
          <CatalogueFilters
            :filters="filters"
            :categories="categories"
            :facet-bar="facetBar"
            :certification-facet="certificationFacet"
            :numeric-facets="numericFacets"
            :enum-facets="enumFacets"
            @apply="visit($event)"
          />
        </BaseCard>
      </aside>

      <div class="flex min-w-0 flex-col gap-4">
        <BaseAlert v-if="searchUnavailable" tone="warning">
          {{ t('products.index.searchUnavailable') }}
        </BaseAlert>

        <div v-else class="flex items-center justify-between gap-3">
          <p class="text-tabular text-body-sm text-text-secondary">
            {{ t('products.index.resultsCount', { count: products.meta.total }) }}
          </p>
        </div>

        <div
          v-if="loading"
          role="status"
          class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          :aria-label="t('products.index.loading')"
        >
          <ProductCardSkeleton v-for="n in 6" :key="n" />
        </div>

        <BaseEmptyState
          v-else-if="!searchUnavailable && products.data.length === 0"
          :title="t('products.index.empty')"
          :description="t('products.index.emptyHint')"
          :icon="PackageSearch"
        />

        <div v-else-if="products.data.length > 0" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Link
            v-for="product in products.data"
            :key="product.id"
            route="products.show"
            :params="{ locale, slug: product.slug }"
            class="block rounded-xl"
          >
            <ProductCard :product="product" />
          </Link>
        </div>

        <BasePagination
          :meta="products.meta"
          :previous-label="t('products.index.previous')"
          :next-label="t('products.index.next')"
          @change="visit(filters, $event)"
        />
      </div>
    </div>
  </div>
</template>
