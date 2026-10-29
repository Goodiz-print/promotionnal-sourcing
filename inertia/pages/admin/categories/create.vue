<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BasePageHeader from '~/components/base/base_page_header.vue'
import CategoryForm from '~/components/categories/form/category_form.vue'
import type { CategoryType } from '#shared/types/category'

defineProps<{ parents: CategoryType[] }>()

const { t, locale } = useI18n()

const indexUrl = computed(() => urlFor('admin.categories.index', { locale: locale.value }))
</script>

<template>
  <Head :title="t('categories.create.title')" />

  <div class="mx-auto flex w-full max-w-[720px] flex-col gap-8">
    <BasePageHeader
      :title="t('categories.create.title')"
      :description="t('categories.create.subtitle')"
      :back-href="indexUrl"
      :back-label="t('categories.back')"
    />

    <CategoryForm mode="create" :parents="parents" />
  </div>
</template>
