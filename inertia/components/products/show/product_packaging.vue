<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { ProductPackagingType } from '#shared/types/product'

/**
 * Conditionnement / logistique (écart 3) : lignes renseignées uniquement. Les
 * 3 dimensions du carton maître sont regroupées en « L × l × H ».
 */
const props = defineProps<{ packaging: ProductPackagingType | null }>()

const { t } = useI18n()

const rows = computed(() => {
  const p = props.packaging
  if (!p) return []
  const list: { label: string; value: string }[] = []
  const add = (key: string, value: string | number | null) => {
    if (value !== null && value !== '') list.push({ label: t(key), value: String(value) })
  }
  add('products.manage.fields.packageType', p.packageType)
  add('products.manage.fields.unitGrossWeightG', p.unitGrossWeightG)
  add('products.manage.fields.innerCartonQty', p.innerCartonQty)
  add('products.manage.fields.outerCartonQty', p.outerCartonQty)
  if (p.outerCartonLengthMm || p.outerCartonWidthMm || p.outerCartonHeightMm) {
    list.push({
      label: t('products.show.cartonDimensions'),
      value: [p.outerCartonLengthMm, p.outerCartonWidthMm, p.outerCartonHeightMm]
        .map((mm) => mm ?? '—')
        .join(' × '),
    })
  }
  add('products.manage.fields.outerCartonGrossWeightG', p.outerCartonGrossWeightG)
  add('products.manage.fields.outerCartonVolumeM3', p.outerCartonVolumeM3)
  return list
})
</script>

<template>
  <BaseSection v-if="rows.length > 0" :title="t('products.show.packaging')">
    <BaseDescriptionList :items="rows" />
  </BaseSection>
</template>
