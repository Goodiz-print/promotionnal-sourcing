<script setup lang="ts" generic="T extends string">
import { computed } from 'vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import FacetSection from '~/components/catalogue/facet_section.vue'
import type { EnumFacetCountsType } from '#shared/types/product'

/**
 * Groupe de cases pour une facette d'énumération fermée combinée en **OU**
 * (provenance, stock…). Générique sur `T` (le slug de l'enum) pour que `selected`
 * et l'évènement conservent le type ; le libellé est rendu par l'appelant
 * (`labelFor`) depuis sa clé i18n. Avec des compteurs, les options sans produit sont
 * masquées (sauf celles cochées) et le groupe disparaît s'il est vide.
 */
const props = defineProps<{
  title: string
  options: readonly T[]
  selected: T[]
  labelFor: (option: T) => string
  idPrefix: string
  counts?: EnumFacetCountsType
}>()

defineEmits<{
  toggle: [option: T, checked: boolean]
}>()

const visibleOptions = computed<T[]>(() =>
  props.options.filter(
    (option) =>
      !props.counts?.hasCounts ||
      (props.counts.counts[option] ?? 0) > 0 ||
      props.selected.includes(option)
  )
)
</script>

<template>
  <FacetSection v-if="visibleOptions.length > 0" :title="title">
    <BaseCheckbox
      v-for="option in visibleOptions"
      :id="`${idPrefix}-${option}`"
      :key="option"
      :model-value="selected.includes(option)"
      :label="labelFor(option)"
      @update:model-value="(checked: boolean) => $emit('toggle', option, checked)"
    />
  </FacetSection>
</template>
