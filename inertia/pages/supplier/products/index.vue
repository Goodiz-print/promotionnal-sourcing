<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base_button.vue'
import type { ProductType } from '#shared/types/product'

defineProps<{ products: ProductType[] }>()

const { t, locale } = useI18n()

function destroy(product: ProductType) {
  if (!window.confirm(t('products.manage.confirmDelete'))) return
  router.delete(urlFor('supplier.products.destroy', { locale: locale.value, id: product.id }), {
    preserveScroll: true,
  })
}
</script>

<template>
  <Head :title="t('products.manage.index.title')" />

  <div class="mx-auto flex max-w-[960px] flex-col gap-6 px-6 py-12">
    <div class="flex items-center justify-between">
      <h1 class="text-[28px] tracking-[-0.5px]">{{ t('products.manage.index.title') }}</h1>
      <Link
        route="supplier.products.create"
        :params="{ locale }"
        class="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)]"
      >
        {{ t('products.manage.newProduct') }}
      </Link>
    </div>

    <p v-if="products.length === 0" class="text-[var(--gray-6)]">
      {{ t('products.manage.index.empty') }}
    </p>

    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="product in products"
        :key="product.id"
        class="flex items-center gap-4 rounded border border-[var(--gray-3)] p-3"
      >
        <img
          v-if="product.imageUrl"
          :src="product.imageUrl"
          alt=""
          class="h-12 w-12 rounded object-cover"
        />
        <div class="flex-1">
          <p class="font-medium">{{ product.name ?? product.slug }}</p>
          <span class="text-sm text-[var(--gray-6)]">
            {{ product.isActive ? t('products.manage.published') : t('products.manage.draft') }}
          </span>
        </div>
        <Link
          route="supplier.products.edit"
          :params="{ locale, id: product.id }"
          class="text-sm text-[var(--color-primary)] hover:underline"
        >
          {{ t('products.manage.edit') }}
        </Link>
        <BaseButton variant="secondary" @click="destroy(product)">
          {{ t('products.manage.delete') }}
        </BaseButton>
      </li>
    </ul>
  </div>
</template>
