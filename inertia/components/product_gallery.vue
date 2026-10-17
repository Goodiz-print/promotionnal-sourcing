<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from '~/i18n'
import type { ProductImageType } from '#shared/types/product'
import type { ImageVariantName } from '#shared/types/image_variant'

const props = defineProps<{
  images: ProductImageType[]
  fallbackUrl: string | null
  alt: string
}>()

const { t } = useI18n()

interface GalleryItem {
  key: string
  thumb: string
  main: string
}

// Variante demandée si le job l'a générée, sinon l'original.
function variantUrl(image: ProductImageType, name: ImageVariantName): string {
  return image.variants.find((variant) => variant.name === name)?.url ?? image.url
}

// Images à afficher : la galerie si elle existe, sinon repli sur l'image
// principale dénormalisée (`products.image_url`).
const items = computed<GalleryItem[]>(() => {
  if (props.images.length > 0) {
    return props.images.map((image) => ({
      key: String(image.id),
      thumb: variantUrl(image, 'card'),
      main: variantUrl(image, 'detail'),
    }))
  }
  return props.fallbackUrl
    ? [{ key: props.fallbackUrl, thumb: props.fallbackUrl, main: props.fallbackUrl }]
    : []
})

const selected = ref(0)
</script>

<template>
  <div v-if="items.length > 0" class="flex flex-col gap-3 md:w-80">
    <img :src="items[selected].main" :alt="alt" class="aspect-square w-full rounded object-cover" />

    <div v-if="items.length > 1" class="grid grid-cols-4 gap-2">
      <button
        v-for="(item, index) in items"
        :key="item.key"
        type="button"
        :aria-label="t('products.show.viewImage')"
        :aria-current="index === selected"
        class="aspect-square overflow-hidden rounded border data-[active=true]:border-[var(--color-primary)] border-[var(--gray-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
        :data-active="index === selected"
        @click="selected = index"
      >
        <img :src="item.thumb" :alt="alt" class="h-full w-full object-cover" />
      </button>
    </div>
  </div>
</template>
