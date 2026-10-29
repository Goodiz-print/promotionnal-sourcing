<script setup lang="ts" generic="T extends string">
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import FacetSection from '~/components/catalogue/facet_section.vue'

/**
 * Groupe de cases pour une facette d'énumération fermée combinée en **OU**
 * (provenance, stock…). Générique sur `T` (le slug de l'enum) pour que `selected`
 * et l'évènement conservent le type ; le libellé est rendu par l'appelant
 * (`labelFor`) depuis sa clé i18n. Extrait pour ne pas dupliquer ce bloc.
 */
defineProps<{
  title: string
  options: readonly T[]
  selected: T[]
  labelFor: (option: T) => string
  idPrefix: string
}>()

defineEmits<{
  toggle: [option: T, checked: boolean]
}>()
</script>

<template>
  <FacetSection :title="title">
    <BaseCheckbox
      v-for="option in options"
      :id="`${idPrefix}-${option}`"
      :key="option"
      :model-value="selected.includes(option)"
      :label="labelFor(option)"
      @update:model-value="(checked: boolean) => $emit('toggle', option, checked)"
    />
  </FacetSection>
</template>
