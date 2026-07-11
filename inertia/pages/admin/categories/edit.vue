<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import CategoryForm from '~/components/categories/form/category_form.vue'
import type { CategoryType, CategoryEditType } from '#shared/types/category'

defineProps<{
  category: CategoryEditType
  parents: CategoryType[]
}>()

const { t } = useI18n()
</script>

<template>
  <Head :title="t('categories.edit.title')" />

  <div class="mx-auto max-w-[960px] px-6 py-12">
    <h1 class="mb-8 text-[28px] tracking-[-0.5px]">{{ t('categories.edit.title') }}</h1>
    <CategoryForm mode="edit" :parents="parents" :category="category" />
  </div>
</template>
