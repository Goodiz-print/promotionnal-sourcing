<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import type { QuoteCartItemType, UpdateQuoteCartItemData } from '#shared/types/quote_cart'

/**
 * Options d'une ligne du panier : variante (couleur/taille) et marquage
 * (position × technique, nombre de couleurs). Chaque choix est émis aussitôt
 * (`change`) : la ligne l'enregistre, et l'estimation revient recalculée.
 */
const props = defineProps<{ item: QuoteCartItemType }>()

const emit = defineEmits<{ change: [changes: UpdateQuoteCartItemData] }>()

const { t } = useI18n()

const variantId = ref<number | null>(props.item.variantId)
const markingId = ref<number | null>(props.item.markingPositionTechniqueId)
const colors = ref<number | null>(props.item.markingColors)

// Le serveur fait foi : une option refusée (flash d'erreur) revient à sa valeur.
watch(
  () => [props.item.variantId, props.item.markingPositionTechniqueId, props.item.markingColors],
  () => {
    variantId.value = props.item.variantId
    markingId.value = props.item.markingPositionTechniqueId
    colors.value = props.item.markingColors
  }
)

const marking = computed(
  () => props.item.markingOptions.find((option) => option.id === markingId.value) ?? null
)

function onVariant(value: number | null) {
  variantId.value = value
  emit('change', { variantId: value })
}

function onMarking(value: number | null) {
  markingId.value = value
  colors.value = null
  emit('change', { markingPositionTechniqueId: value, markingColors: null })
}

function onColors(value: number | null) {
  colors.value = value
  const max = marking.value?.maxColors ?? null
  // Une saisie vide, nulle ou hors bornes n'est pas un nombre de couleurs.
  if (value === null || !Number.isInteger(value) || value < 1) return
  if (max !== null && value > max) return
  emit('change', { markingColors: value })
}
</script>

<template>
  <div
    v-if="item.variantOptions.length > 0 || item.markingOptions.length > 0"
    class="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3"
  >
    <BaseSelect
      v-if="item.variantOptions.length > 0"
      :id="`quote-cart-variant-${item.id}`"
      :model-value="variantId"
      :label="t('quote_cart.line.variant')"
      @update:model-value="onVariant"
    >
      <option :value="null">{{ t('quote_cart.line.variantAny') }}</option>
      <option v-for="option in item.variantOptions" :key="option.id" :value="option.id">
        {{ option.label }}
      </option>
    </BaseSelect>

    <BaseSelect
      v-if="item.markingOptions.length > 0"
      :id="`quote-cart-marking-${item.id}`"
      :model-value="markingId"
      :label="t('quote_cart.line.marking')"
      @update:model-value="onMarking"
    >
      <option :value="null">{{ t('quote_cart.line.markingNone') }}</option>
      <option v-for="option in item.markingOptions" :key="option.id" :value="option.id">
        {{ option.label }}
      </option>
    </BaseSelect>

    <BaseInput
      v-if="marking"
      :id="`quote-cart-colors-${item.id}`"
      :model-value="colors"
      type="number"
      :min="1"
      :max="marking.maxColors ?? undefined"
      :step="1"
      :label="t('quote_cart.line.markingColors')"
      :hint="
        marking.maxColors !== null
          ? t('quote_cart.line.markingColorsMax', { count: marking.maxColors })
          : ''
      "
      @update:model-value="onColors"
    />
  </div>
</template>
