<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { Boxes, Image as ImageIcon } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import ProductActions from '~/components/admin/product/product_actions.vue'
import ProductImagesSection from '~/components/admin/product/product_images_section.vue'
import ProductModerationHistory from '~/components/admin/product/product_moderation_history.vue'
import ProductOverview from '~/components/admin/product/product_overview.vue'
import ProductPricingSection from '~/components/admin/product/product_pricing_section.vue'
import ProductTaxonomySection from '~/components/admin/product/product_taxonomy_section.vue'
import ProductTranslationsSection from '~/components/admin/product/product_translations_section.vue'
import ProductVariantsSection from '~/components/admin/product/product_variants_section.vue'
import ProductVisibilityBadge from '~/components/admin/product_visibility_badge.vue'
import BaseAlert from '~/components/base/base_alert.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseStat from '~/components/base/base_stat.vue'
import type { AdminProductDetail } from '#shared/types/admin_product'

const props = defineProps<{ product: AdminProductDetail }>()

const { t, locale } = useI18n()

const indexUrl = computed(() => urlFor('admin.products.index', { locale: locale.value }))
const title = computed(() => props.product.name ?? props.product.slug)
</script>

<template>
  <Head :title="title" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="title"
      :description="product.slug"
      :back-href="indexUrl"
      :back-label="t('admin.products.back')"
    >
      <template #meta>
        <ProductVisibilityBadge :status="product.visibilityStatus" />
      </template>
    </BasePageHeader>

    <BaseAlert v-if="product.lifecycleStatus === 'retired'" tone="warning">
      {{ t('admin.products.detail.archivedNotice') }}
    </BaseAlert>

    <ProductActions v-if="product.canManage" :product="product" />

    <div class="grid gap-4 sm:grid-cols-2">
      <BaseStat
        :label="t('admin.products.columns.variants')"
        :value="product.variantsCount"
        :icon="Boxes"
      />
      <BaseStat
        :label="t('admin.products.columns.images')"
        :value="product.imagesCount"
        :icon="ImageIcon"
      />
    </div>

    <ProductOverview :product="product" />
    <ProductVariantsSection :variants="product.variants" />
    <ProductPricingSection :tiers="product.priceTiers" :variants="product.variants" />
    <ProductImagesSection :images="product.images" :product-name="title" />
    <ProductTranslationsSection :translations="product.translations" />
    <ProductTaxonomySection
      :certifications="product.certifications"
      :attributes="product.attributes"
    />
    <ProductModerationHistory :history="product.moderationHistory" />
  </div>
</template>
