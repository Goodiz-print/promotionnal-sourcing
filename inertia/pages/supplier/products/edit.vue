<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import ProductForm from '~/components/products/form/product_form.vue'
import type { CategoryType } from '#shared/types/category'
import type { AttributeWithValuesType } from '#shared/types/attribute'
import type { ProductEditType } from '#shared/types/product'

defineProps<{
  product: ProductEditType
  categories: CategoryType[]
  attributes: AttributeWithValuesType[]
}>()

const { t } = useI18n()
</script>

<template>
  <Head :title="t('products.manage.edit.title')" />

  <div class="mx-auto max-w-[960px] px-6 py-12">
    <h1 class="mb-8 text-[28px] tracking-[-0.5px]">{{ t('products.manage.edit.title') }}</h1>
    <ProductForm mode="edit" :product="product" :categories="categories" :attributes="attributes" />
  </div>
</template>
