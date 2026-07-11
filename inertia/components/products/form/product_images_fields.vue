<script setup lang="ts">
import { inject, computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseFileInput from '~/components/base_file_input.vue'
import BaseButton from '~/components/base_button.vue'
import type { ProductImageType } from '#shared/types/product'
import { ProductFormKey } from './types'

const props = defineProps<{ existingImages: ProductImageType[] }>()

const form = inject(ProductFormKey)!

const { t } = useI18n()

// Images déjà persistées, hors celles marquées pour suppression.
const visibleExisting = computed(() =>
  props.existingImages.filter((image) => !form.removedImageIds.includes(image.id))
)

function removeExisting(id: number) {
  form.removedImageIds = [...form.removedImageIds, id]
}

function onFiles(files: File[]) {
  form.images = [...form.images, ...files]
}

function removeNew(index: number) {
  form.images = form.images.filter((_, current) => current !== index)
}

function previewUrl(file: File): string {
  return URL.createObjectURL(file)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="visibleExisting.length > 0 || form.images.length > 0"
      class="grid grid-cols-3 gap-3 sm:grid-cols-4"
    >
      <div v-for="image in visibleExisting" :key="`e-${image.id}`" class="flex flex-col gap-1">
        <img :src="image.url" alt="" class="aspect-square w-full rounded object-cover" />
        <BaseButton variant="secondary" @click="removeExisting(image.id)">
          {{ t('products.manage.removeImage') }}
        </BaseButton>
      </div>
      <div v-for="(file, index) in form.images" :key="`n-${index}`" class="flex flex-col gap-1">
        <img :src="previewUrl(file)" alt="" class="aspect-square w-full rounded object-cover" />
        <BaseButton variant="secondary" @click="removeNew(index)">
          {{ t('products.manage.removeImage') }}
        </BaseButton>
      </div>
    </div>

    <BaseFileInput
      id="images"
      multiple
      :label="t('products.manage.fields.images')"
      @change="onFiles"
    />
  </div>
</template>
