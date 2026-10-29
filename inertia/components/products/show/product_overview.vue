<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseCard from '~/components/base/base_card.vue'
import ProductGallery from '~/components/product_gallery.vue'
import VariantSelector from '~/components/products/variant_selector.vue'
import ProductQuoteActions from '~/components/products/product_quote_actions.vue'
import type { ProductDetailType } from '#shared/types/product'
import type { ProductRfqContextType } from '#shared/types/rfq'

/**
 * Carte d'en-tête de la fiche produit : galerie à gauche, prix, quantité
 * minimale, description, choix de la variante et demande de devis à droite.
 * La variante choisie remonte au parent (`v-model`), qui en déduit la grille
 * de prix à afficher.
 */
const props = defineProps<{ product: ProductDetailType; rfqContext: ProductRfqContextType }>()

const selectedVariantId = defineModel<number | null>({ required: true })

const { t } = useI18n()

const selectedVariant = computed(
  () => props.product.variants.find((variant) => variant.id === selectedVariantId.value) ?? null
)

const price = computed(() => {
  const { priceMin, priceMax, currency } = props.product
  if (!priceMin && !priceMax) return null
  if (priceMin && priceMax && priceMin !== priceMax) return `${priceMin} – ${priceMax} ${currency}`
  return `${priceMin ?? priceMax} ${currency}`
})
</script>

<template>
  <BaseCard padding="md" class="grid gap-8 md:grid-cols-[320px_1fr]">
    <ProductGallery
      :images="product.images"
      :fallback-url="product.imageUrl"
      :alt="product.name ?? product.slug"
      :focus-image-id="selectedVariant?.imageId ?? null"
    />

    <div class="flex min-w-0 flex-col gap-5">
      <div class="flex flex-col gap-1">
        <p v-if="price" class="text-tabular text-heading-lg text-indigo-600">{{ price }}</p>
        <p v-if="product.minQuantity" class="text-tabular text-caption text-text-muted">
          {{ t('products.card.minQuantity', { count: product.minQuantity }) }}
        </p>
      </div>

      <p v-if="product.description" class="whitespace-pre-line text-body-md text-text-secondary">
        {{ product.description }}
      </p>

      <VariantSelector
        v-if="product.variants.length > 0"
        :variants="product.variants"
        :selected-id="selectedVariantId"
        @select="selectedVariantId = $event"
      />

      <ProductQuoteActions :product-id="product.id" :rfq-context="rfqContext" />
    </div>
  </BaseCard>
</template>
