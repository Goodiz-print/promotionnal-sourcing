<script setup lang="ts">
import { computed } from 'vue'
import { Image as ImageIcon } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseCard from '~/components/base/base_card.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import type { ProductType } from '#shared/types/product'

/**
 * Vignette produit des grilles du catalogue : image (ou pictogramme de repli),
 * nom, prix, MOQ et badges (made-in-Europe, éco, nouveauté). Le lien est porté
 * par le parent, pour laisser le fournisseur l'afficher sans navigation.
 */
const props = defineProps<{ product: ProductType }>()

const { t } = useI18n()

const price = computed(() => {
  const { priceMin, priceMax, currency } = props.product
  if (!priceMin && !priceMax) return null
  const min = priceMin ? `${priceMin} ${currency}` : null
  if (priceMin && priceMax && priceMin !== priceMax) return `${priceMin} – ${priceMax} ${currency}`
  return min ?? `${priceMax} ${currency}`
})

const isNew = computed(() => props.product.lifecycleStatus === 'new')

const hasBadges = computed(() => props.product.madeInEurope || props.product.isEco || isNew.value)
</script>

<template>
  <BaseCard as="article" hover padding="sm" class="flex h-full flex-col gap-3">
    <img
      v-if="product.imageUrl"
      :src="product.imageUrl"
      :alt="product.name ?? product.slug"
      class="aspect-square w-full rounded-md bg-sunken object-cover"
    />
    <div
      v-else
      class="flex aspect-square w-full items-center justify-center rounded-md bg-sunken text-text-muted"
      aria-hidden="true"
    >
      <ImageIcon :size="32" :stroke-width="1.5" />
    </div>

    <div class="flex flex-1 flex-col gap-1">
      <h3 class="line-clamp-2 text-body-sm font-semibold text-text-primary">
        {{ product.name ?? product.slug }}
      </h3>
      <p v-if="price" class="text-tabular text-body-sm font-semibold text-indigo-600">
        {{ price }}
      </p>
      <p v-if="product.minQuantity" class="text-tabular text-caption text-text-muted">
        {{ t('products.card.minQuantity', { count: product.minQuantity }) }}
      </p>
    </div>

    <div v-if="hasBadges" class="flex flex-wrap gap-1.5">
      <BaseBadge v-if="product.madeInEurope" tone="brand">
        {{ t('products.card.madeInEurope') }}
      </BaseBadge>
      <BaseBadge v-if="product.isEco" tone="success">{{ t('products.card.eco') }}</BaseBadge>
      <BaseBadge v-if="isNew" tone="info">{{ t('products.card.new') }}</BaseBadge>
    </div>
  </BaseCard>
</template>
