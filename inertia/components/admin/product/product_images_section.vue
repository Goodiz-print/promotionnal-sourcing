<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseSection from '~/components/base/base_section.vue'
import type { ProductImageType } from '#shared/types/product'

/** Galerie en lecture seule : variante « card » si le job l'a générée, sinon l'original. */
defineProps<{ images: ProductImageType[]; productName: string }>()

const { t } = useI18n()

const thumbUrl = (image: ProductImageType) =>
  image.variants.find((variant) => variant.name === 'card')?.url ?? image.url
</script>

<template>
  <BaseSection :title="t('admin.products.detail.images')">
    <p v-if="images.length === 0" class="text-body-sm text-text-secondary">
      {{ t('admin.products.detail.noImages') }}
    </p>
    <ul v-else class="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
      <li
        v-for="image in images"
        :key="image.id"
        class="aspect-square overflow-hidden rounded-lg border border-hairline bg-card"
      >
        <img
          :src="thumbUrl(image)"
          :alt="
            t('admin.products.detail.imageAlt', { position: image.position + 1, name: productName })
          "
          loading="lazy"
          class="h-full w-full object-cover"
        />
      </li>
    </ul>
  </BaseSection>
</template>
