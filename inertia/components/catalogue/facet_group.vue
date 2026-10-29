<script setup lang="ts">
import { computed } from 'vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import FacetSection from '~/components/catalogue/facet_section.vue'
import FacetOption from '~/components/catalogue/facet_option.vue'
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
  <FacetSection
    v-if="visibleValues.length > 0 || attribute.ranges.length > 0"
    :title="attribute.name ?? attribute.slug"
  >
    <!-- Valeurs énumérées (couleur, matière, propres à la catégorie) : filtre ET. -->
    <BaseCheckbox
      v-for="value in visibleValues"
      :id="`attr-${value.id}`"
      :key="value.id"
      :model-value="selectedIds.includes(value.id)"
      @update:model-value="(checked) => emit('toggle', value.id, checked)"
    >
      <FacetOption
        :label="value.label ?? value.value"
        :hex="value.hex"
        :count="hasCounts ? value.count : null"
      />
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
      <FacetOption
        :label="rangeLabel(range.minValue, range.maxValue, unitSuffix)"
        :count="hasCounts ? range.count : null"
      />
    </BaseCheckbox>
  </FacetSection>
</template>
