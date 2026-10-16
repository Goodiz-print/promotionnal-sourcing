<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import ProductGallery from '~/components/product_gallery.vue'
import type { ProductDetailType } from '#shared/types/product'

const props = defineProps<{ product: ProductDetailType }>()

const { t, locale } = useI18n()

const price = computed(() => {
  const { priceMin, priceMax, currency } = props.product
  if (!priceMin && !priceMax) return null
  if (priceMin && priceMax && priceMin !== priceMax) return `${priceMin} – ${priceMax} ${currency}`
  return `${priceMin ?? priceMax} ${currency}`
})
</script>

<template>
  <Head :title="product.name ?? product.slug" />

  <div class="mx-auto flex max-w-[960px] flex-col gap-8 px-6 py-12">
    <Link
      route="products.index"
      :params="{ locale }"
      class="text-sm text-[var(--color-primary)] hover:underline"
    >
      ← {{ t('products.show.backToCatalogue') }}
    </Link>

    <div class="flex flex-col gap-8 md:flex-row">
      <ProductGallery
        :images="product.images"
        :fallback-url="product.imageUrl"
        :alt="product.name ?? product.slug"
      />

      <div class="flex flex-1 flex-col gap-4">
        <div>
          <h1 class="text-[28px] tracking-[-0.5px]">{{ product.name ?? product.slug }}</h1>
          <Link
            route="suppliers.show"
            :params="{ locale, slug: product.supplier.slug }"
            class="text-sm text-[var(--color-primary)] hover:underline"
          >
            {{ product.supplier.name ?? product.supplier.slug }}
          </Link>
        </div>

        <p v-if="price" class="text-xl font-medium">{{ price }}</p>
        <p v-if="product.description" class="text-[var(--gray-6)]">{{ product.description }}</p>

        <dl class="flex flex-col gap-2 text-sm">
          <div
            v-if="product.minQuantity"
            class="flex justify-between border-b border-[var(--gray-3)] py-1"
          >
            <dt class="text-[var(--gray-6)]">{{ t('products.show.minQuantity') }}</dt>
            <dd>{{ product.minQuantity }}</dd>
          </div>
          <div
            v-if="product.category"
            class="flex justify-between border-b border-[var(--gray-3)] py-1"
          >
            <dt class="text-[var(--gray-6)]">{{ t('products.show.category') }}</dt>
            <dd>{{ product.category.name ?? product.category.slug }}</dd>
          </div>
          <div
            v-if="product.originCountry"
            class="flex justify-between border-b border-[var(--gray-3)] py-1"
          >
            <dt class="text-[var(--gray-6)]">{{ t('products.show.origin') }}</dt>
            <dd>{{ product.originCountry }}</dd>
          </div>
          <div
            v-for="attribute in product.attributes"
            :key="attribute.attributeSlug"
            class="flex justify-between border-b border-[var(--gray-3)] py-1"
          >
            <dt class="text-[var(--gray-6)]">
              {{ attribute.attributeName ?? attribute.attributeSlug }}
            </dt>
            <dd>{{ attribute.label }}</dd>
          </div>
        </dl>

        <div class="sm:w-56">
          <BaseButton>{{ t('products.show.requestQuote') }}</BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>
