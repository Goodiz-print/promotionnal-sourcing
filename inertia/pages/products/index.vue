<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import ProductCard from '~/components/product_card.vue'
import CatalogueFilters from '~/components/catalogue_filters.vue'
import type { Paginated } from '#shared/types/pagination'
import type { CategoryType, CategoryFacetBarType } from '#shared/types/category'
import type { CertificationFacetBarType } from '#shared/types/certification'
import type {
  ProductType,
  ProductDirectoryFilters,
  CatalogueNumericFacetsType,
} from '#shared/types/product'

defineProps<{
  products: Paginated<ProductType>
  searchUnavailable: boolean
  filters: ProductDirectoryFilters
  categories: CategoryType[]
  facetBar: CategoryFacetBarType
  certificationFacet: CertificationFacetBarType
  numericFacets: CatalogueNumericFacetsType
}>()

const { t, locale } = useI18n()

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
      ],
    }
  )
}
</script>

<template>
  <Head :title="t('products.index.title')" />

  <div class="mx-auto flex max-w-[1100px] flex-col gap-8 px-6 py-12">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('products.index.title') }}</h1>
      <p class="text-lg text-[var(--gray-6)]">{{ t('products.index.subtitle') }}</p>
    </div>

    <div class="flex flex-col gap-8 md:flex-row">
      <aside class="shrink-0 md:w-64">
        <CatalogueFilters
          :filters="filters"
          :categories="categories"
          :facet-bar="facetBar"
          :certification-facet="certificationFacet"
          :numeric-facets="numericFacets"
          @apply="visit($event)"
        />
      </aside>

      <div class="flex flex-1 flex-col gap-6">
        <p v-if="searchUnavailable" role="alert" class="text-[var(--gray-6)]">
          {{ t('products.index.searchUnavailable') }}
        </p>
        <p v-else class="text-sm text-[var(--gray-6)]">
          {{ t('products.index.resultsCount', { count: products.meta.total }) }}
        </p>

        <p v-if="!searchUnavailable && products.data.length === 0" class="text-[var(--gray-6)]">
          {{ t('products.index.empty') }}
        </p>

        <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            v-for="product in products.data"
            :key="product.id"
            route="products.show"
            :params="{ locale, slug: product.slug }"
            class="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
          >
            <ProductCard :product="product" />
          </Link>
        </div>

        <div v-if="products.meta.lastPage > 1" class="flex items-center justify-center gap-4">
          <BaseButton
            variant="secondary"
            :disabled="products.meta.currentPage <= 1"
            @click="visit(filters, products.meta.currentPage - 1)"
          >
            {{ t('products.index.previous') }}
          </BaseButton>
          <span class="text-sm text-[var(--gray-6)]">
            {{ products.meta.currentPage }} / {{ products.meta.lastPage }}
          </span>
          <BaseButton
            variant="secondary"
            :disabled="products.meta.currentPage >= products.meta.lastPage"
            @click="visit(filters, products.meta.currentPage + 1)"
          >
            {{ t('products.index.next') }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>
