<script setup lang="ts">
import { computed } from 'vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import { useRangeLabel } from '~/composables/use_range_label'
import type { CategoryFacetType, CategoryFacetValueType } from '#shared/types/category'
import type { AttributeRangeSelectionType } from '#shared/types/product'

const props = defineProps<{
  attribute: CategoryFacetType
  selectedIds: number[]
  // Tranches d'attributs EAV cochées (tous attributs confondus) — filtrées par slug.
  selectedRanges: AttributeRangeSelectionType[]
  hasCounts: boolean
}>()

const emit = defineEmits<{
  toggle: [valueId: number, checked: boolean]
  toggleRange: [slug: string, minValue: number | null, maxValue: number | null, checked: boolean]
}>()

const rangeLabel = useRangeLabel()

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

const unitSuffix = computed(() => props.attribute.unit ?? '')

// Une tranche est cochée quand le slug de l'attribut + ses bornes figurent dans la
// sélection courante (`[min, max[` identifié par slug + bornes).
function isRangeSelected(minValue: number | null, maxValue: number | null): boolean {
  return props.selectedRanges.some(
    (range) =>
      range.slug === props.attribute.slug &&
      range.minValue === minValue &&
      range.maxValue === maxValue
  )
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

    <!-- Tranches numériques (plan L125) : cliquables, mêmes OU/compteurs que les valeurs. -->
    <BaseCheckbox
      v-for="(range, index) in attribute.ranges"
      :id="`attr-range-${attribute.slug}-${index}`"
      :key="`range-${index}`"
      :model-value="isRangeSelected(range.minValue, range.maxValue)"
      @update:model-value="
        (checked) => emit('toggleRange', attribute.slug, range.minValue, range.maxValue, checked)
      "
    >
      <span class="flex flex-1 items-center gap-2">
        <span class="flex-1">{{ rangeLabel(range.minValue, range.maxValue, unitSuffix) }}</span>
        <span v-if="hasCounts && range.count !== null" class="text-xs text-[var(--gray-6)]">
          {{ range.count }}
        </span>
      </span>
    </BaseCheckbox>
  </fieldset>
</template>
