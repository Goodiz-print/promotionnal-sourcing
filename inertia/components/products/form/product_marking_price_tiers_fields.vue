<script setup lang="ts">
import { inject, computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseButton from '~/components/base/base_button.vue'
import type { MarkingTechniqueType } from '#shared/types/marking'
import { ProductFormKey } from './types'

defineProps<{ markingTechniques: MarkingTechniqueType[] }>()

const form = inject(ProductFormKey)!

const { t } = useI18n()

// Erreurs imbriquées (`markingPriceTiers.0.unitPrice`) : clés dynamiques.
const errors = computed(() => form.errors as Record<string, string | undefined>)

function add() {
  form.markingPriceTiers = [
    ...form.markingPriceTiers,
    { markingTechniqueId: null, minQuantity: null, unitPrice: null },
  ]
}

function remove(index: number) {
  form.markingPriceTiers = form.markingPriceTiers.filter((_, current) => current !== index)
}

function onTechnique(index: number, raw: string | null) {
  form.markingPriceTiers[index].markingTechniqueId = raw ? Number(raw) : null
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-body-sm text-text-secondary">
      {{ t('products.manage.marking.priceTiersHint') }}
    </p>
    <div
      v-for="(tier, index) in form.markingPriceTiers"
      :key="index"
      class="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <BaseSelect
        :id="`marking-tier-${index}-technique`"
        :model-value="tier.markingTechniqueId === null ? '' : String(tier.markingTechniqueId)"
        :label="t('products.manage.marking.technique')"
        :error="errors[`markingPriceTiers.${index}.markingTechniqueId`]"
        class="flex-1"
        @update:model-value="(raw) => onTechnique(index, raw)"
      >
        <option value="">—</option>
        <option v-for="item in markingTechniques" :key="item.id" :value="String(item.id)">
          {{ item.name ?? item.slug }}
        </option>
      </BaseSelect>
      <BaseInput
        :id="`marking-tier-${index}-qty`"
        v-model="tier.minQuantity"
        type="number"
        :min="1"
        :label="t('products.manage.priceTiers.minQuantity')"
        :error="errors[`markingPriceTiers.${index}.minQuantity`]"
        class="flex-1"
      />
      <BaseInput
        :id="`marking-tier-${index}-price`"
        v-model="tier.unitPrice"
        type="number"
        :min="0"
        :label="t('products.manage.priceTiers.unitPrice')"
        :error="errors[`markingPriceTiers.${index}.unitPrice`]"
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
