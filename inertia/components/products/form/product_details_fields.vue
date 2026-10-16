<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import type { CategoryType } from '#shared/types/category'
import { ProductFormKey } from './types'

defineProps<{ categories: CategoryType[] }>()

const form = inject(ProductFormKey)!

const { t } = useI18n()

function onCategory(value: string | null) {
  form.categoryId = value ? Number(value) : null
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <BaseSelect
      id="category"
      :model-value="form.categoryId === null ? '' : String(form.categoryId)"
      :label="t('products.manage.fields.category')"
      :error="form.errors.categoryId"
      @update:model-value="onCategory"
    >
      <option value="">{{ t('products.manage.fields.chooseCategory') }}</option>
      <option v-for="category in categories" :key="category.id" :value="String(category.id)">
        {{ category.name ?? category.slug }}
      </option>
    </BaseSelect>

    <div class="flex flex-col gap-4 sm:flex-row">
      <BaseInput
        id="priceMin"
        v-model="form.priceMin"
        type="number"
        :min="0"
        :label="t('products.manage.fields.priceMin')"
        :error="form.errors.priceMin"
        class="flex-1"
      />
      <BaseInput
        id="priceMax"
        v-model="form.priceMax"
        type="number"
        :min="0"
        :label="t('products.manage.fields.priceMax')"
        :error="form.errors.priceMax"
        class="flex-1"
      />
      <BaseInput
        id="currency"
        v-model="form.currency"
        type="text"
        :label="t('products.manage.fields.currency')"
        :error="form.errors.currency"
        class="sm:w-24"
      />
    </div>

    <div class="flex flex-col gap-4 sm:flex-row">
      <BaseInput
        id="minQuantity"
        v-model="form.minQuantity"
        type="number"
        :min="0"
        :label="t('products.manage.fields.minQuantity')"
        :error="form.errors.minQuantity"
        class="flex-1"
      />
      <BaseInput
        id="originCountry"
        v-model="form.originCountry"
        type="text"
        :label="t('products.manage.fields.originCountry')"
        :error="form.errors.originCountry"
        class="flex-1"
      />
    </div>

    <div class="flex flex-col gap-2">
      <BaseCheckbox
        id="madeInEurope"
        v-model="form.madeInEurope"
        :label="t('products.manage.fields.madeInEurope')"
      />
      <BaseCheckbox
        id="isActive"
        v-model="form.isActive"
        :label="t('products.manage.fields.isActive')"
      />
    </div>
  </div>
</template>
