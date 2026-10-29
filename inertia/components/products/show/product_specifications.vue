<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { ProductDetailType } from '#shared/types/product'

/** Caractéristiques de la fiche : MOQ, catégorie, origine, puis facettes résolues. */
const props = defineProps<{ product: ProductDetailType }>()

const { t } = useI18n()

const items = computed(() => {
  const { product } = props
  const list: { label: string; value: string | number | null | undefined }[] = [
    { label: t('products.show.minQuantity'), value: product.minQuantity },
    { label: t('products.show.category'), value: product.category?.name ?? product.category?.slug },
    { label: t('products.show.origin'), value: product.originCountry },
  ]
  for (const attribute of product.attributes) {
    list.push({ label: attribute.attributeName ?? attribute.attributeSlug, value: attribute.label })
  }
  return list.filter((item) => item.value !== null && item.value !== undefined && item.value !== '')
})
</script>

<template>
  <BaseSection v-if="items.length > 0" :title="t('products.show.specifications')">
    <BaseDescriptionList :items="items" />
  </BaseSection>
</template>
