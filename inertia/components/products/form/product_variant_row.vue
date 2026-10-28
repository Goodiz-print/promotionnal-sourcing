<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import BaseButton from '~/components/base/base_button.vue'
import type { AttributeWithValuesType } from '#shared/types/attribute'
import { PRODUCT_STOCK_STATUSES, type ProductImageType } from '#shared/types/product'
import { ProductFormKey } from './types'

const props = defineProps<{
  index: number
  attributes: AttributeWithValuesType[]
  images: ProductImageType[]
}>()

defineEmits<{ remove: [] }>()

const form = inject(ProductFormKey)!

const { t } = useI18n()

// La ligne vit dans le formulaire injecté (pas dans un prop) : pas de mutation de prop.
const variant = computed(() => form.variants[props.index])
// Erreurs de validation imbriquées (`variants.0.sku`) : clés dynamiques.
const errors = computed(() => form.errors as Record<string, string | undefined>)

function selectedValue(attribute: AttributeWithValuesType): string {
  const found = attribute.values.find((value) => variant.value.attributeValueIds.includes(value.id))
  return found ? String(found.id) : ''
}

// Une seule valeur par attribut : remplace celle de l'attribut, garde les autres.
function onAttribute(attribute: AttributeWithValuesType, raw: string | null) {
  const own = new Set(attribute.values.map((value) => value.id))
  const others = variant.value.attributeValueIds.filter((id) => !own.has(id))
  variant.value.attributeValueIds = raw ? [...others, Number(raw)] : others
}

function onImage(raw: string | null) {
  variant.value.imageId = raw ? Number(raw) : null
}

// Statut de stock (plan L98) : `''` = non renseigné (`null`).
const STOCK_STATUSES = PRODUCT_STOCK_STATUSES
function onStockStatus(raw: string | null) {
  variant.value.stockStatus = raw ? (raw as (typeof STOCK_STATUSES)[number]) : null
}

const field = (name: string) => `variants.${props.index}.${name}`
</script>

<template>
  <fieldset class="flex flex-col gap-3 rounded border border-[var(--gray-3)] p-4">
    <div class="flex items-end gap-3">
      <BaseInput
        :id="`variant-${index}-sku`"
        v-model="form.variants[index].sku"
        :label="t('products.manage.variants.sku')"
        :error="errors[field('sku')]"
        class="flex-1"
      />
      <BaseButton variant="danger" @click="$emit('remove')">{{
        t('products.manage.variants.remove')
      }}</BaseButton>
    </div>

    <BaseInput
      :id="`variant-${index}-gtin`"
      v-model="form.variants[index].gtin"
      :label="t('products.manage.variants.gtin')"
      :error="errors[field('gtin')]"
    />

    <div class="grid gap-3 sm:grid-cols-2">
      <BaseInput
        :id="`variant-${index}-stock-quantity`"
        v-model="form.variants[index].stockQuantity"
        type="number"
        :min="0"
        :label="t('products.manage.variants.stockQuantity')"
        :error="errors[field('stockQuantity')]"
      />

      <BaseSelect
        :id="`variant-${index}-stock-status`"
        :model-value="variant.stockStatus ?? ''"
        :label="t('products.manage.variants.stockStatus')"
        :error="errors[field('stockStatus')]"
        @update:model-value="onStockStatus"
      >
        <option value="">{{ t('products.manage.variants.stockUnknown') }}</option>
        <option v-for="status in STOCK_STATUSES" :key="status" :value="status">
          {{ t(`products.manage.variants.stockStatuses.${status}`) }}
        </option>
      </BaseSelect>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <BaseSelect
        v-for="attribute in attributes"
        :id="`variant-${index}-attr-${attribute.id}`"
        :key="attribute.id"
        :model-value="selectedValue(attribute)"
        :label="attribute.name ?? attribute.slug"
        :error="errors[field('attributeValueIds')]"
        @update:model-value="(raw) => onAttribute(attribute, raw)"
      >
        <option value="">—</option>
        <option v-for="value in attribute.values" :key="value.id" :value="String(value.id)">
          {{ value.label ?? value.value }}
        </option>
      </BaseSelect>
    </div>

    <BaseSelect
      v-if="images.length > 0"
      :id="`variant-${index}-image`"
      :model-value="variant.imageId === null ? '' : String(variant.imageId)"
      :label="t('products.manage.variants.image')"
      :error="errors[field('imageId')]"
      @update:model-value="onImage"
    >
      <option value="">—</option>
      <option v-for="(image, position) in images" :key="image.id" :value="String(image.id)">
        #{{ position + 1 }}
      </option>
    </BaseSelect>

    <BaseCheckbox
      :id="`variant-${index}-active`"
      v-model="form.variants[index].isActive"
      :label="t('products.manage.variants.isActive')"
    />
  </fieldset>
</template>
