<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import ProductForm from '~/components/products/form/product_form.vue'
import DocumentManager from '~/components/documents/document_manager.vue'
import type { CategoryType } from '#shared/types/category'
import type { AttributeWithValuesType } from '#shared/types/attribute'
import type { CertificationType } from '#shared/types/certification'
import type { ProductEditType } from '#shared/types/product'
import { PRODUCT_DOCUMENT_TYPES } from '#shared/types/document'

const props = defineProps<{
  product: ProductEditType
  categories: CategoryType[]
  attributes: AttributeWithValuesType[]
  certifications: CertificationType[]
}>()

const { t, locale } = useI18n()
</script>

<template>
  <Head :title="t('products.manage.edit.title')" />

  <div class="mx-auto max-w-[960px] px-6 py-12">
    <h1 class="mb-8 text-[28px] tracking-[-0.5px]">{{ t('products.manage.edit.title') }}</h1>
    <ProductForm
      mode="edit"
      :product="product"
      :categories="categories"
      :attributes="attributes"
      :certifications="certifications"
    />

    <DocumentManager
      class="mt-12 max-w-[720px]"
      :documents="product.documents"
      :store-url="urlFor('supplier.products.documents.store', { locale, id: props.product.id })"
      :destroy-url="
        (document) =>
          urlFor('supplier.products.documents.destroy', {
            locale,
            id: props.product.id,
            documentId: document.id,
          })
      "
      :kinds="PRODUCT_DOCUMENT_TYPES"
      field="type"
      option-label-key="documents.types"
      field-label-key="documents.fields.type"
      :label-for="(document) => t(`documents.types.${document.type}`)"
      :title="t('documents.datasheet.title')"
      :empty-label="t('documents.datasheet.empty')"
    />
  </div>
</template>
