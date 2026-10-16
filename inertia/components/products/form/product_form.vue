<script setup lang="ts">
import { provide } from 'vue'
import { useForm, router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE } from '#shared/types/i18n'
import BaseButton from '~/components/base/base_button.vue'
import ProductTranslationsFields from '~/components/products/form/product_translations_fields.vue'
import ProductDetailsFields from '~/components/products/form/product_details_fields.vue'
import ProductFacetsFields from '~/components/products/form/product_facets_fields.vue'
import ProductImagesFields from '~/components/products/form/product_images_fields.vue'
import type { CategoryType } from '#shared/types/category'
import type { AttributeWithValuesType } from '#shared/types/attribute'
import type { ProductEditType } from '#shared/types/product'
import { ProductFormKey, type ProductFormState } from './types'

const props = defineProps<{
  mode: 'create' | 'edit'
  categories: CategoryType[]
  attributes: AttributeWithValuesType[]
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
  translations: initialTranslations(),
  priceMin: props.product?.priceMin ? Number(props.product.priceMin) : null,
  priceMax: props.product?.priceMax ? Number(props.product.priceMax) : null,
  currency: props.product?.currency ?? 'EUR',
  minQuantity: props.product?.minQuantity ?? null,
  originCountry: props.product?.originCountry ?? '',
  madeInEurope: props.product?.madeInEurope ?? false,
  isActive: props.product?.isActive ?? true,
  attributeValueIds: props.product ? [...props.product.attributeValueIds] : [],
  images: [],
  removedImageIds: [],
})

provide(ProductFormKey, form)

function submit() {
  const target =
    props.mode === 'create'
      ? urlFor('supplier.products.store', { locale: locale.value })
      : urlFor('supplier.products.update', { locale: locale.value, id: props.product!.id })

  // Omet les champs numériques/texte vides (VineJS les traite comme absents).
  form
    .transform((data) => {
      const payload: Record<string, unknown> = {
        categoryId: data.categoryId,
        // La langue source n'est fixée qu'à la création (#75).
        ...(props.mode === 'create' ? { sourceLocale: DEFAULT_CONTENT_LOCALE } : {}),
        translations: data.translations,
        currency: data.currency || 'EUR',
        madeInEurope: data.madeInEurope,
        isActive: data.isActive,
        attributeValueIds: data.attributeValueIds,
        images: data.images,
        removedImageIds: data.removedImageIds,
      }
      if (data.priceMin !== null) payload.priceMin = data.priceMin
      if (data.priceMax !== null) payload.priceMax = data.priceMax
      if (data.minQuantity !== null) payload.minQuantity = data.minQuantity
      if (data.originCountry) payload.originCountry = data.originCountry
      return payload
    })
    .post(target, { forceFormData: true, preserveScroll: true })
}

function cancel() {
  router.get(urlFor('supplier.products.index', { locale: locale.value }))
}
</script>

<template>
  <form class="flex max-w-[720px] flex-col gap-8" @submit.prevent="submit">
    <ProductTranslationsFields />
    <ProductDetailsFields :categories="categories" />

    <div>
      <h2 class="mb-2 font-medium">{{ t('products.manage.facets') }}</h2>
      <ProductFacetsFields :attributes="attributes" />
    </div>

    <div>
      <h2 class="mb-2 font-medium">{{ t('products.manage.images') }}</h2>
      <ProductImagesFields :existing-images="product?.images ?? []" />
    </div>

    <div class="flex gap-3">
      <BaseButton type="submit" :disabled="form.processing">{{
        t('products.manage.save')
      }}</BaseButton>
      <BaseButton variant="secondary" @click="cancel">{{ t('products.manage.cancel') }}</BaseButton>
    </div>
  </form>
</template>
