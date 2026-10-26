<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import { ProductFormKey, type ProductPackagingFormState } from './types'

const form = inject(ProductFormKey)!

const { t } = useI18n()

/** Clés numériques du bloc conditionnement (hors `packageType`, texte). */
type NumberKey = Exclude<keyof ProductPackagingFormState, 'packageType'>

/**
 * Descripteurs des champs numériques — évite neuf `BaseInput` quasi identiques.
 * Les dimensions / poids / quantités sont des entiers (`min` 1) ; le volume est
 * un décimal (`min` du pas de la colonne, `step` 0,0001).
 */
const numberFields: { key: NumberKey; min: number; step?: string }[] = [
  { key: 'unitGrossWeightG', min: 1 },
  { key: 'innerCartonQty', min: 1 },
  { key: 'outerCartonQty', min: 1 },
  { key: 'outerCartonLengthMm', min: 1 },
  { key: 'outerCartonWidthMm', min: 1 },
  { key: 'outerCartonHeightMm', min: 1 },
  { key: 'outerCartonGrossWeightG', min: 1 },
  { key: 'outerCartonVolumeM3', min: 0.0001, step: '0.0001' },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <BaseInput
      id="packageType"
      v-model="form.packaging.packageType"
      type="text"
      :label="t('products.manage.fields.packageType')"
      :placeholder="t('products.manage.packageTypeHint')"
      :error="form.errors['packaging.packageType']"
    />

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <BaseInput
        v-for="field in numberFields"
        :id="field.key"
        :key="field.key"
        v-model="form.packaging[field.key]"
        type="number"
        :min="field.min"
        :step="field.step"
        :label="t(`products.manage.fields.${field.key}`)"
        :error="form.errors[`packaging.${field.key}`]"
      />
    </div>
  </div>
</template>
