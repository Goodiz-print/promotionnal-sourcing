<script setup lang="ts">
import { provide } from 'vue'
import { useForm, router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE } from '#shared/types/i18n'
import { DEFAULT_PRODUCT_LIFECYCLE_STATUS } from '#shared/types/product'
import BaseButton from '~/components/base/base_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import ProductTranslationsFields from '~/components/products/form/product_translations_fields.vue'
import ProductDetailsFields from '~/components/products/form/product_details_fields.vue'
import ProductCommercialFields from '~/components/products/form/product_commercial_fields.vue'
import ProductFacetsFields from '~/components/products/form/product_facets_fields.vue'
import ProductComplianceFields from '~/components/products/form/product_compliance_fields.vue'
import ProductPackagingFields from '~/components/products/form/product_packaging_fields.vue'
import ProductMarkingFields from '~/components/products/form/product_marking_fields.vue'
import ProductImagesFields from '~/components/products/form/product_images_fields.vue'
import ProductVariantsFields from '~/components/products/form/product_variants_fields.vue'
import ProductPriceTiersFields from '~/components/products/form/product_price_tiers_fields.vue'
import type { CategoryType } from '#shared/types/category'
import type { AttributeWithValuesType } from '#shared/types/attribute'
import type { CertificationType } from '#shared/types/certification'
import type { MarkingTechniqueType } from '#shared/types/marking'
import type { ProductEditType } from '#shared/types/product'
import { ProductFormKey, type ProductFormState } from './types'
import { buildProductPayload } from './payload'

const props = defineProps<{
  mode: 'create' | 'edit'
  categories: CategoryType[]
  attributes: AttributeWithValuesType[]
  certifications: CertificationType[]
  markingTechniques: MarkingTechniqueType[]
  product?: ProductEditType
}>()

const { t, locale } = useI18n()

function initialTranslations(): ProductFormState['translations'] {
  const translations = {} as ProductFormState['translations']
  for (const current of CONTENT_LOCALES) {
    translations[current] = {
      name: props.product?.translations[current]?.name ?? '',
      description: props.product?.translations[current]?.description ?? '',
    }
  }
  return translations
}

const form = useForm<ProductFormState>({
  categoryId: props.product?.categoryId ?? null,
  sourceLocale: props.product?.sourceLocale ?? DEFAULT_CONTENT_LOCALE,
  translations: initialTranslations(),
  priceMin: props.product?.priceMin ? Number(props.product.priceMin) : null,
  priceMax: props.product?.priceMax ? Number(props.product.priceMax) : null,
  currency: props.product?.currency ?? 'EUR',
  minQuantity: props.product?.minQuantity ?? null,
  originCountry: props.product?.originCountry ?? '',
  madeInEurope: props.product?.madeInEurope ?? false,
  isActive: props.product?.isActive ?? true,
  brand: props.product?.brand ?? '',
  hsCode: props.product?.hsCode ?? '',
  isConfigurable: props.product?.isConfigurable ?? false,
  lifecycleStatus: props.product?.lifecycleStatus ?? DEFAULT_PRODUCT_LIFECYCLE_STATUS,
  releasedAt: props.product?.releasedAt ?? '',
  supplierCategoryRaw: props.product?.supplierCategoryRaw ?? '',
  leadTimeDays: props.product?.leadTimeDays ?? null,
  rushService: props.product?.rushService ?? false,
  rushLeadTimeDays: props.product?.rushLeadTimeDays ?? null,
  videoUrl: props.product?.videoUrl ?? '',
  recycledContentPercent: props.product?.recycledContentPercent ?? null,
  cautionComment: props.product?.cautionComment ?? '',
  certificationIds: props.product ? [...props.product.certificationIds] : [],
  attributeValueIds: props.product ? [...props.product.attributeValueIds] : [],
  images: [],
  removedImageIds: [],
  variants: (props.product?.variants ?? []).map((variant) => ({
    sku: variant.sku,
    isActive: variant.isActive,
    imageId: variant.imageId,
    gtin: variant.gtin ?? '',
    stockQuantity: variant.stockQuantity,
    stockStatus: variant.stockStatus,
    attributeValueIds: [...variant.attributeValueIds],
  })),
  priceTiers: (props.product?.priceTiers ?? []).map((tier) => ({
    variantSku: props.product?.variants.find((v) => v.id === tier.variantId)?.sku ?? '',
    minQuantity: tier.minQuantity,
    unitPrice: Number(tier.unitPrice),
  })),
  // Conditionnement / logistique (écart 3) : le volume (décimal) revient en
  // chaîne, converti en nombre pour le champ.
  packaging: {
    packageType: props.product?.packaging?.packageType ?? '',
    unitGrossWeightG: props.product?.packaging?.unitGrossWeightG ?? null,
    innerCartonQty: props.product?.packaging?.innerCartonQty ?? null,
    outerCartonQty: props.product?.packaging?.outerCartonQty ?? null,
    outerCartonLengthMm: props.product?.packaging?.outerCartonLengthMm ?? null,
    outerCartonWidthMm: props.product?.packaging?.outerCartonWidthMm ?? null,
    outerCartonHeightMm: props.product?.packaging?.outerCartonHeightMm ?? null,
    outerCartonGrossWeightG: props.product?.packaging?.outerCartonGrossWeightG ?? null,
    outerCartonVolumeM3: props.product?.packaging?.outerCartonVolumeM3
      ? Number(props.product.packaging.outerCartonVolumeM3)
      : null,
  },
  // Marquage structuré (écart 2) : positions (avec techniques) et grille de prix.
  // Les décimaux (frais technique, prix) reviennent en chaîne, reconvertis.
  printable: props.product?.printable ?? false,
  markingPositions: (props.product?.markingPositions ?? []).map((position) => ({
    name: position.name,
    maxWidthMm: position.maxWidthMm,
    maxHeightMm: position.maxHeightMm,
    templateDocumentId: position.templateDocumentId,
    techniques: position.techniques.map((technique) => ({
      markingTechniqueId: technique.markingTechniqueId,
      maxColors: technique.maxColors,
      defaultSetupCharge:
        technique.defaultSetupCharge !== null ? Number(technique.defaultSetupCharge) : null,
    })),
  })),
  markingPriceTiers: (props.product?.markingPriceTiers ?? []).map((tier) => ({
    markingTechniqueId: tier.markingTechniqueId,
    minQuantity: tier.minQuantity,
    unitPrice: Number(tier.unitPrice),
  })),
})

provide(ProductFormKey, form)

function submit() {
  const target =
    props.mode === 'create'
      ? urlFor('supplier.products.store', { locale: locale.value })
      : urlFor('supplier.products.update', { locale: locale.value, id: props.product!.id })

  // Construit le payload (champs vides omis, blocs « remplacement d'ensemble »
  // toujours transmis) — voir `buildProductPayload`.
  form
    .transform((data) => buildProductPayload(data, props.product))
    // Inertia omet les tableaux vides en multipart : sans fichier, on reste en JSON
    // pour que « aucune variante / aucun palier » (`[]`) soit bien transmis.
    .post(target, { forceFormData: form.images.length > 0, preserveScroll: true })
}

function cancel() {
  router.get(urlFor('supplier.products.index', { locale: locale.value }))
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="submit">
    <BaseSection
      as="fieldset"
      :title="t('products.manage.sections.content')"
      :description="t('products.manage.sections.contentHint')"
    >
      <ProductTranslationsFields />
    </BaseSection>

    <BaseSection as="fieldset" :title="t('products.manage.sections.details')">
      <ProductDetailsFields :categories="categories" />
    </BaseSection>

    <BaseSection as="fieldset" :title="t('products.manage.commercial')">
      <ProductCommercialFields />
    </BaseSection>

    <BaseSection as="fieldset" :title="t('products.manage.facets')">
      <ProductFacetsFields :attributes="attributes" />
    </BaseSection>

    <BaseSection as="fieldset" :title="t('products.manage.compliance')">
      <ProductComplianceFields :certifications="certifications" />
    </BaseSection>

    <BaseSection as="fieldset" :title="t('products.manage.packaging')">
      <ProductPackagingFields />
    </BaseSection>

    <BaseSection as="fieldset" :title="t('products.manage.marking.title')">
      <ProductMarkingFields
        :marking-techniques="markingTechniques"
        :documents="product?.documents ?? []"
      />
    </BaseSection>

    <BaseSection as="fieldset" :title="t('products.manage.images')">
      <ProductImagesFields :existing-images="product?.images ?? []" />
    </BaseSection>

    <BaseSection as="fieldset" :title="t('products.manage.variants.title')">
      <ProductVariantsFields :attributes="attributes" :existing-images="product?.images ?? []" />
    </BaseSection>

    <BaseSection
      as="fieldset"
      :title="t('products.manage.priceTiers.title')"
      :description="t('products.manage.priceTiers.hint')"
    >
      <ProductPriceTiersFields />
    </BaseSection>

    <div
      class="sticky bottom-4 z-20 flex items-center justify-end gap-3 rounded-xl border border-hairline bg-white/90 px-4 py-3 shadow-elevation-2 backdrop-blur-md"
    >
      <BaseButton variant="secondary" @click="cancel">{{ t('products.manage.cancel') }}</BaseButton>
      <BaseButton type="submit" :loading="form.processing">
        {{ t('products.manage.save') }}
      </BaseButton>
    </div>
  </form>
</template>
