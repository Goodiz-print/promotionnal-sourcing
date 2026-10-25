<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import { PRODUCT_LIFECYCLE_STATUSES } from '#shared/types/product'
import { ProductFormKey } from './types'

const form = inject(ProductFormKey)!

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-4 sm:flex-row">
      <BaseInput
        id="brand"
        v-model="form.brand"
        type="text"
        :label="t('products.manage.fields.brand')"
        :error="form.errors.brand"
        class="flex-1"
      />
      <BaseInput
        id="hsCode"
        v-model="form.hsCode"
        type="text"
        :label="t('products.manage.fields.hsCode')"
        :error="form.errors.hsCode"
        class="flex-1"
      />
    </div>

    <div class="flex flex-col gap-4 sm:flex-row">
      <BaseSelect
        id="lifecycleStatus"
        v-model="form.lifecycleStatus"
        :label="t('products.manage.fields.lifecycleStatus')"
        :error="form.errors.lifecycleStatus"
        class="flex-1"
      >
        <option v-for="status in PRODUCT_LIFECYCLE_STATUSES" :key="status" :value="status">
          {{ t(`products.manage.lifecycle.${status}`) }}
        </option>
      </BaseSelect>
      <BaseInput
        id="releasedAt"
        v-model="form.releasedAt"
        type="date"
        :label="t('products.manage.fields.releasedAt')"
        :error="form.errors.releasedAt"
        class="flex-1"
      />
    </div>

    <BaseInput
      id="supplierCategoryRaw"
      v-model="form.supplierCategoryRaw"
      type="text"
      :label="t('products.manage.fields.supplierCategoryRaw')"
      :error="form.errors.supplierCategoryRaw"
    />

    <BaseInput
      id="videoUrl"
      v-model="form.videoUrl"
      type="url"
      :label="t('products.manage.fields.videoUrl')"
      :error="form.errors.videoUrl"
    />

    <div class="flex flex-col gap-4 sm:flex-row">
      <BaseInput
        id="leadTimeDays"
        v-model="form.leadTimeDays"
        type="number"
        :min="0"
        :label="t('products.manage.fields.leadTimeDays')"
        :error="form.errors.leadTimeDays"
        class="flex-1"
      />
      <BaseInput
        id="rushLeadTimeDays"
        v-model="form.rushLeadTimeDays"
        type="number"
        :min="0"
        :label="t('products.manage.fields.rushLeadTimeDays')"
        :error="form.errors.rushLeadTimeDays"
        class="flex-1"
      />
    </div>

    <div class="flex flex-col gap-2">
      <BaseCheckbox
        id="rushService"
        v-model="form.rushService"
        :label="t('products.manage.fields.rushService')"
      />
      <BaseCheckbox
        id="isConfigurable"
        v-model="form.isConfigurable"
        :label="t('products.manage.fields.isConfigurable')"
      />
    </div>
  </div>
</template>
