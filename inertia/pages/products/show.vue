<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Building2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import DocumentList from '~/components/documents/document_list.vue'
import PriceTierTable from '~/components/products/price_tier_table.vue'
import ProductCompliance from '~/components/products/show/product_compliance.vue'
import ProductMarking from '~/components/products/show/product_marking.vue'
import ProductOverview from '~/components/products/show/product_overview.vue'
import ProductPackaging from '~/components/products/show/product_packaging.vue'
import ProductSpecifications from '~/components/products/show/product_specifications.vue'
import type { ProductDetailType } from '#shared/types/product'
import type { ProductRfqContextType } from '#shared/types/rfq'

const props = defineProps<{ product: ProductDetailType; rfqContext: ProductRfqContextType }>()

const { t, locale } = useI18n()

const catalogueUrl = computed(() => urlFor('products.index', { locale: locale.value }))

const selectedVariantId = ref<number | null>(props.product.variants[0]?.id ?? null)

// Grille de la variante choisie si elle a ses propres paliers, sinon celle du produit.
const tiers = computed(() => {
  const own = props.product.priceTiers.filter((tier) => tier.variantId === selectedVariantId.value)
  return own.length > 0 ? own : props.product.priceTiers.filter((tier) => tier.variantId === null)
})

const isNew = computed(() => props.product.lifecycleStatus === 'new')
</script>

<template>
  <Head :title="product.name ?? product.slug" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="product.name ?? product.slug"
      :back-href="catalogueUrl"
      :back-label="t('products.show.backToCatalogue')"
    >
      <template #meta>
        <Link
          route="suppliers.show"
          :params="{ locale, slug: product.supplier.slug }"
          class="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-card px-3 py-1 text-caption font-semibold text-text-secondary transition-colors hover:text-indigo-600"
        >
          <Building2 :size="14" aria-hidden="true" />
          {{ product.supplier.name ?? product.supplier.slug }}
        </Link>
        <BaseBadge v-if="product.madeInEurope" tone="brand">
          {{ t('products.card.madeInEurope') }}
        </BaseBadge>
        <BaseBadge v-if="product.isEco" tone="success">{{ t('products.card.eco') }}</BaseBadge>
        <BaseBadge v-if="isNew" tone="info">{{ t('products.card.new') }}</BaseBadge>
      </template>
    </BasePageHeader>

    <ProductOverview v-model="selectedVariantId" :product="product" :rfq-context="rfqContext" />

    <BaseSection v-if="tiers.length > 0" :title="t('products.show.priceTiers')" flush>
      <PriceTierTable :tiers="tiers" />
    </BaseSection>

    <!-- Deux colonnes indépendantes : chaque carte se colle à celle du dessus (effet masonry). -->
    <div class="grid items-start gap-8 lg:grid-cols-2">
      <div class="flex min-w-0 flex-col gap-8">
        <ProductSpecifications :product="product" />
        <ProductPackaging :packaging="product.packaging" />
      </div>
      <div class="flex min-w-0 flex-col gap-8">
        <ProductCompliance :product="product" />
        <ProductMarking
          :positions="product.markingPositions"
          :price-tiers="product.markingPriceTiers"
        />
      </div>
    </div>

    <BaseSection v-if="product.documents.length > 0" :title="t('documents.datasheet.title')">
      <DocumentList
        :documents="product.documents"
        :label-for="(document) => t(`documents.types.${document.type}`)"
      />
    </BaseSection>
  </div>
</template>
