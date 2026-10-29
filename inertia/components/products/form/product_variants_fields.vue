<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import ProductVariantRow from '~/components/products/form/product_variant_row.vue'
import type { AttributeWithValuesType } from '#shared/types/attribute'
import type { ProductImageType } from '#shared/types/product'
import { ProductFormKey } from './types'

defineProps<{ attributes: AttributeWithValuesType[]; existingImages: ProductImageType[] }>()

const form = inject(ProductFormKey)!

const { t } = useI18n()

function add() {
  form.variants = [
    ...form.variants,
    {
      sku: '',
      isActive: true,
      imageId: null,
      gtin: '',
      stockQuantity: null,
      stockStatus: null,
      attributeValueIds: [],
    },
  ]
}

function remove(index: number) {
  form.variants = form.variants.filter((_, current) => current !== index)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p v-if="form.variants.length === 0" class="text-body-sm text-text-secondary">
      {{ t('products.manage.variants.empty') }}
    </p>
    <ProductVariantRow
      v-for="(_, index) in form.variants"
      :key="index"
      :index="index"
      :attributes="attributes"
      :images="existingImages"
      @remove="remove(index)"
    />
    <div>
      <BaseButton variant="secondary" @click="add">{{
        t('products.manage.variants.add')
      }}</BaseButton>
    </div>
  </div>
</template>
