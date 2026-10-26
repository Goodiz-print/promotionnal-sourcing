<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import { ProductFormKey } from './types'

const form = inject(ProductFormKey)!

const { t } = useI18n()
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

    <BaseInput
      id="unitGrossWeightG"
      v-model="form.packaging.unitGrossWeightG"
      type="number"
      :min="1"
      :label="t('products.manage.fields.unitGrossWeightG')"
      :error="form.errors['packaging.unitGrossWeightG']"
    />

    <div class="flex flex-col gap-4 sm:flex-row">
      <BaseInput
        id="innerCartonQty"
        v-model="form.packaging.innerCartonQty"
        type="number"
        :min="1"
        :label="t('products.manage.fields.innerCartonQty')"
        :error="form.errors['packaging.innerCartonQty']"
        class="flex-1"
      />
      <BaseInput
        id="outerCartonQty"
        v-model="form.packaging.outerCartonQty"
        type="number"
        :min="1"
        :label="t('products.manage.fields.outerCartonQty')"
        :error="form.errors['packaging.outerCartonQty']"
        class="flex-1"
      />
    </div>

    <div class="flex flex-col gap-4 sm:flex-row">
      <BaseInput
        id="outerCartonLengthMm"
        v-model="form.packaging.outerCartonLengthMm"
        type="number"
        :min="1"
        :label="t('products.manage.fields.outerCartonLengthMm')"
        :error="form.errors['packaging.outerCartonLengthMm']"
        class="flex-1"
      />
      <BaseInput
        id="outerCartonWidthMm"
        v-model="form.packaging.outerCartonWidthMm"
        type="number"
        :min="1"
        :label="t('products.manage.fields.outerCartonWidthMm')"
        :error="form.errors['packaging.outerCartonWidthMm']"
        class="flex-1"
      />
      <BaseInput
        id="outerCartonHeightMm"
        v-model="form.packaging.outerCartonHeightMm"
        type="number"
        :min="1"
        :label="t('products.manage.fields.outerCartonHeightMm')"
        :error="form.errors['packaging.outerCartonHeightMm']"
        class="flex-1"
      />
    </div>

    <div class="flex flex-col gap-4 sm:flex-row">
      <BaseInput
        id="outerCartonGrossWeightG"
        v-model="form.packaging.outerCartonGrossWeightG"
        type="number"
        :min="1"
        :label="t('products.manage.fields.outerCartonGrossWeightG')"
        :error="form.errors['packaging.outerCartonGrossWeightG']"
        class="flex-1"
      />
      <BaseInput
        id="outerCartonVolumeM3"
        v-model="form.packaging.outerCartonVolumeM3"
        type="number"
        :min="0"
        step="0.0001"
        :label="t('products.manage.fields.outerCartonVolumeM3')"
        :error="form.errors['packaging.outerCartonVolumeM3']"
        class="flex-1"
      />
    </div>
  </div>
</template>
