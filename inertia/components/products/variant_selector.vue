<script setup lang="ts">
import { useI18n } from '~/i18n'
import type { ProductDetailVariantType } from '#shared/types/product'

defineProps<{ variants: ProductDetailVariantType[]; selectedId: number | null }>()

defineEmits<{ select: [variantId: number] }>()

const { t } = useI18n()

// Libellé = valeurs de facettes (« Rouge · L »), repli sur le SKU.
function label(variant: ProductDetailVariantType): string {
  const parts = variant.attributes.map((attribute) => attribute.label).filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : variant.sku
}
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-2 text-caption font-semibold text-text-muted">
      {{ t('products.show.variants') }}
    </legend>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="variant in variants"
        :key="variant.id"
        type="button"
        :aria-pressed="variant.id === selectedId"
        class="cursor-pointer rounded-pill border px-3.5 py-1.5 text-body-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        :class="
          variant.id === selectedId
            ? 'border-indigo-500 bg-brand-subtle text-indigo-700'
            : 'border-input bg-canvas text-text-primary hover:border-strong hover:bg-ink-50'
        "
        @click="$emit('select', variant.id)"
      >
        {{ label(variant) }}
      </button>
    </div>
  </fieldset>
</template>
