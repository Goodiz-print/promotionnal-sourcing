<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BasePageHeader from '~/components/base/base_page_header.vue'
import CategoryAttributesSection from '~/components/categories/attributes/category_attributes_section.vue'
import CategoryForm from '~/components/categories/form/category_form.vue'
import type {
  CategoryType,
  CategoryEditType,
  CategoryAttributeEditType,
  CategoryAttributeOption,
} from '#shared/types/category'

withDefaults(
  defineProps<{
    category: CategoryEditType
    parents: CategoryType[]
    categoryAttributes?: CategoryAttributeEditType[]
    availableAttributes?: CategoryAttributeOption[]
  }>(),
  { categoryAttributes: () => [], availableAttributes: () => [] }
)

const { t, locale } = useI18n()

const indexUrl = computed(() => urlFor('admin.categories.index', { locale: locale.value }))
</script>

<template>
  <Head :title="t('categories.update.title')" />

  <div class="flex w-full flex-col gap-8">
    <BasePageHeader
      :title="t('categories.update.title')"
      :description="t('categories.update.subtitle', { slug: category.slug })"
      :back-href="indexUrl"
      :back-label="t('categories.back')"
    />

    <CategoryForm mode="edit" :parents="parents" :category="category" />

    <CategoryAttributesSection
      :category-id="category.id"
      :attributes="categoryAttributes"
      :available-attributes="availableAttributes"
    />
  </div>
</template>
