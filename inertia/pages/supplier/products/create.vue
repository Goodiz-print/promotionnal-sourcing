<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BasePageHeader from '~/components/base/base_page_header.vue'
import ProductForm from '~/components/products/form/product_form.vue'
import type { CategoryType } from '#shared/types/category'
import type { AttributeWithValuesType } from '#shared/types/attribute'
import type { CertificationType } from '#shared/types/certification'
import type { MarkingTechniqueType } from '#shared/types/marking'

defineProps<{
  categories: CategoryType[]
  attributes: AttributeWithValuesType[]
  certifications: CertificationType[]
  markingTechniques: MarkingTechniqueType[]
}>()

const { t, locale } = useI18n()
</script>

<template>
  <Head :title="t('products.manage.create.title')" />

  <div class="mx-auto flex w-full max-w-[860px] flex-col gap-8">
    <BasePageHeader
      :title="t('products.manage.create.title')"
      :back-href="urlFor('supplier.products.index', { locale })"
      :back-label="t('products.manage.backToList')"
    />
    <ProductForm
      mode="create"
      :categories="categories"
      :attributes="attributes"
      :certifications="certifications"
      :marking-techniques="markingTechniques"
    />
  </div>
</template>
