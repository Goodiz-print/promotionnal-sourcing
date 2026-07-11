<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from '~/i18n'
import type { ProductImageType } from '#shared/types/product'

const props = defineProps<{
  images: ProductImageType[]
  fallbackUrl: string | null
  alt: string
}>()

const { t } = useI18n()

// URLs à afficher : la galerie si elle existe, sinon repli sur l'image
// principale dénormalisée (`products.image_url`).
const urls = computed<string[]>(() => {
  if (props.images.length > 0) return props.images.map((image) => image.url)
  return props.fallbackUrl ? [props.fallbackUrl] : []
})

const selected = ref(0)
</script>

<template>
  <div v-if="urls.length > 0" class="flex flex-col gap-3 md:w-80">
    <img :src="urls[selected]" :alt="alt" class="aspect-square w-full rounded object-cover" />

    <div v-if="urls.length > 1" class="grid grid-cols-4 gap-2">
      <button
        v-for="(url, index) in urls"
        :key="url"
        type="button"
        :aria-label="t('products.show.viewImage')"
        :aria-current="index === selected"
        class="aspect-square overflow-hidden rounded border data-[active=true]:border-[var(--color-primary)] border-[var(--gray-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
        :data-active="index === selected"
        @click="selected = index"
      >
        <img :src="url" :alt="alt" class="h-full w-full object-cover" />
      </button>
    </div>
  </div>
</template>
