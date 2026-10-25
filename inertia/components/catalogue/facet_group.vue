<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import type { CategoryFacetType, CategoryFacetValueType } from '#shared/types/category'

const props = defineProps<{
  attribute: CategoryFacetType
  selectedIds: number[]
  hasCounts: boolean
}>()

const emit = defineEmits<{
  toggle: [valueId: number, checked: boolean]
}>()

const { t } = useI18n()

// Avec des compteurs, on masque les valeurs à 0 (indisponibles dans la
// catégorie) — sauf celles déjà cochées, pour pouvoir les décocher. Sans
// compteur (moteur inerte), on affiche tout.
const visibleValues = computed<CategoryFacetValueType[]>(() =>
  props.attribute.values.filter(
    (value) =>
      !props.hasCounts ||
      value.count === null ||
      value.count > 0 ||
      props.selectedIds.includes(value.id)
  )
)

const unitSuffix = computed(() => (props.attribute.unit ? ` ${props.attribute.unit}` : ''))

function rangeLabel(minValue: number | null, maxValue: number | null): string {
  if (minValue !== null && maxValue !== null) {
    return t('products.index.rangeBetween', { min: minValue, max: maxValue }) + unitSuffix.value
  }
  if (maxValue !== null) {
    return t('products.index.rangeUnder', { max: maxValue }) + unitSuffix.value
  }
  if (minValue !== null) {
    return t('products.index.rangeOver', { min: minValue }) + unitSuffix.value
  }
  return unitSuffix.value.trim()
}
</script>

<template>
  <fieldset
    v-if="visibleValues.length > 0 || attribute.ranges.length > 0"
    class="flex flex-col gap-2"
  >
    <legend class="mb-1 text-sm font-medium">{{ attribute.name ?? attribute.slug }}</legend>

    <!-- Valeurs énumérées (couleur, matière, propres à la catégorie) : filtre ET. -->
    <BaseCheckbox
      v-for="value in visibleValues"
      :id="`attr-${value.id}`"
      :key="value.id"
      :model-value="selectedIds.includes(value.id)"
      @update:model-value="(checked) => emit('toggle', value.id, checked)"
    >
      <span class="flex flex-1 items-center gap-2">
        <span
          v-if="value.hex"
          class="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--gray-4)]"
          :style="{ backgroundColor: value.hex }"
        />
        <span class="flex-1">{{ value.label ?? value.value }}</span>
        <span v-if="hasCounts && value.count !== null" class="text-xs text-[var(--gray-6)]">
          {{ value.count }}
        </span>
      </span>
    </BaseCheckbox>

    <!-- Tranches numériques : affichées avec leur compteur (filtrage à venir). -->
    <ul v-if="attribute.ranges.length > 0" class="flex flex-col gap-1">
      <li
        v-for="(range, index) in attribute.ranges"
        :key="index"
        class="flex items-center justify-between text-sm text-[var(--gray-7)]"
      >
        <span>{{ rangeLabel(range.minValue, range.maxValue) }}</span>
        <span v-if="hasCounts && range.count !== null" class="text-xs text-[var(--gray-6)]">
          {{ range.count }}
        </span>
      </li>
    </ul>
  </fieldset>
</template>
