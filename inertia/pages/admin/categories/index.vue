<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import AdminNav from '~/components/admin/admin_nav.vue'
import BaseButton from '~/components/base/base_button.vue'
import type { CategoryAdminType } from '#shared/types/category'

defineProps<{ categories: CategoryAdminType[] }>()

const { t, locale } = useI18n()

function destroy(category: CategoryAdminType) {
  if (!window.confirm(t('categories.confirmDelete'))) return
  router.delete(urlFor('admin.categories.destroy', { locale: locale.value, id: category.id }), {
    preserveScroll: true,
  })
}
</script>

<template>
  <Head :title="t('categories.index.title')" />

  <div class="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-12">
    <AdminNav current="categories" />

    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[28px] tracking-[-0.5px]">{{ t('categories.index.title') }}</h1>
        <p class="text-sm text-[var(--gray-6)]">{{ t('categories.index.subtitle') }}</p>
      </div>
      <Link
        route="admin.categories.create"
        :params="{ locale }"
        class="shrink-0 rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)]"
      >
        {{ t('categories.newCategory') }}
      </Link>
    </div>

    <p v-if="categories.length === 0" class="text-[var(--gray-6)]">
      {{ t('categories.index.empty') }}
    </p>

    <table v-else class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-[var(--gray-4)] text-left text-[var(--gray-6)]">
          <th class="py-2 pr-4 font-medium">{{ t('categories.index.columns.name') }}</th>
          <th class="py-2 pr-4 font-medium">{{ t('categories.index.columns.slug') }}</th>
          <th class="py-2 pr-4 font-medium">{{ t('categories.index.columns.parent') }}</th>
          <th class="py-2 pr-4 font-medium">{{ t('categories.index.columns.products') }}</th>
          <th class="py-2"></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="category in categories"
          :key="category.id"
          class="border-b border-[var(--gray-3)]"
        >
          <td class="py-3 pr-4 font-medium">{{ category.name ?? category.slug }}</td>
          <td class="py-3 pr-4 text-[var(--gray-6)]">{{ category.slug }}</td>
          <td class="py-3 pr-4 text-[var(--gray-6)]">{{ category.parentName ?? '—' }}</td>
          <td class="py-3 pr-4 text-[var(--gray-6)]">{{ category.productsCount }}</td>
          <td class="flex items-center justify-end gap-3 py-3">
            <Link
              route="admin.categories.edit"
              :params="{ locale, id: category.id }"
              class="text-[var(--color-primary)] hover:underline"
            >
              {{ t('categories.edit') }}
            </Link>
            <BaseButton variant="secondary" @click="destroy(category)">
              {{ t('categories.delete') }}
            </BaseButton>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
