<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import type { AttributeWithValuesType } from '#shared/types/attribute'
import { ProductFormKey } from './types'

defineProps<{ attributes: AttributeWithValuesType[] }>()

const form = inject(ProductFormKey)!

const { t } = useI18n()

function toggle(valueId: number, checked: boolean) {
  form.attributeValueIds = checked
    ? [...form.attributeValueIds, valueId]
    : form.attributeValueIds.filter((id) => id !== valueId)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p v-if="attributes.length === 0" class="text-body-sm text-text-secondary">
      {{ t('products.manage.noFacets') }}
    </p>
    <fieldset v-for="attribute in attributes" :key="attribute.id" class="flex flex-col gap-2">
      <legend class="text-body-sm font-semibold text-text-primary">
        {{ attribute.name ?? attribute.slug }}
      </legend>
      <BaseCheckbox
        v-for="value in attribute.values"
        :id="`facet-${value.id}`"
        :key="value.id"
        :model-value="form.attributeValueIds.includes(value.id)"
        :label="value.label ?? value.value"
        @update:model-value="(checked) => toggle(value.id, checked)"
      />
    </fieldset>
  </div>
</template>
