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
    <legend class="mb-1 text-sm font-medium">{{ t('products.show.variants') }}</legend>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="variant in variants"
        :key="variant.id"
        type="button"
        :aria-pressed="variant.id === selectedId"
        :data-active="variant.id === selectedId"
        class="cursor-pointer rounded border border-[var(--gray-4)] px-3 py-1.5 text-sm data-[active=true]:border-[var(--color-primary)] data-[active=true]:bg-[var(--gray-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
        @click="$emit('select', variant.id)"
      >
        {{ label(variant) }}
      </button>
    </div>
  </fieldset>
</template>
