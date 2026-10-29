<script setup lang="ts">
import { inject, computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseButton from '~/components/base/base_button.vue'
import { ProductFormKey } from './types'

const form = inject(ProductFormKey)!

const { t } = useI18n()

// Erreurs de validation imbriquées (`priceTiers.0.unitPrice`) : clés dynamiques.
const errors = computed(() => form.errors as Record<string, string | undefined>)

// Les paliers peuvent cibler le produit ou l'une des variantes saisies.
const skus = computed(() => form.variants.map((variant) => variant.sku.trim()).filter(Boolean))

function add() {
  form.priceTiers = [...form.priceTiers, { variantSku: '', minQuantity: null, unitPrice: null }]
}

function remove(index: number) {
  form.priceTiers = form.priceTiers.filter((_, current) => current !== index)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-for="(tier, index) in form.priceTiers"
      :key="index"
      class="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <BaseSelect
        v-if="skus.length > 0"
        :id="`tier-${index}-variant`"
        v-model="tier.variantSku"
        :label="t('products.manage.priceTiers.appliesTo')"
        :error="errors[`priceTiers.${index}.variantSku`]"
        class="flex-1"
      >
        <option value="">{{ t('products.manage.priceTiers.allVariants') }}</option>
        <option v-for="sku in skus" :key="sku" :value="sku">{{ sku }}</option>
      </BaseSelect>
      <BaseInput
        :id="`tier-${index}-qty`"
        v-model="tier.minQuantity"
        type="number"
        :min="1"
        :label="t('products.manage.priceTiers.minQuantity')"
        :error="errors[`priceTiers.${index}.minQuantity`]"
        class="flex-1"
      />
      <BaseInput
        :id="`tier-${index}-price`"
        v-model="tier.unitPrice"
        type="number"
        :min="0"
        :label="t('products.manage.priceTiers.unitPrice')"
        :error="errors[`priceTiers.${index}.unitPrice`]"
        class="flex-1"
      />
      <BaseButton variant="danger" @click="remove(index)">{{
        t('products.manage.priceTiers.remove')
      }}</BaseButton>
    </div>
    <div>
      <BaseButton variant="secondary" @click="add">{{
        t('products.manage.priceTiers.add')
      }}</BaseButton>
    </div>
  </div>
</template>
