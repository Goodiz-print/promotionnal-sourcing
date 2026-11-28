<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseCombobox from '~/components/base/base_combobox.vue'
import { useRegionOptions } from '~/composables/use_region_options'

/**
 * Sélecteur d'un pays (code ISO 3166-1 alpha-2) avec recherche, noms dans la
 * langue de la page. `codes` restreint la liste (filtres : seuls les pays présents
 * en base) ; `clearLabel` ajoute une option « Tous les pays » qui émet `null`.
 */
const props = withDefaults(
  defineProps<{
    id: string
    modelValue: string | null
    codes?: readonly string[]
    clearLabel?: string
    label?: string
    hint?: string
    error?: string
    required?: boolean
  }>(),
  { codes: undefined, clearLabel: '', label: '', hint: '', error: '', required: false }
)

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const { t, locale } = useI18n()
const { countryOptions, countryName } = useRegionOptions()

const options = computed(() => {
  if (!props.codes) return countryOptions.value
  return props.codes
    .map((code) => ({ value: code, label: countryName(code) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale.value))
})
</script>

<template>
  <BaseCombobox
    :id="id"
    :model-value="modelValue || null"
    :options="options"
    :placeholder="t('common.country.placeholder')"
    :search-label="t('common.country.search')"
    :no-results-label="t('common.country.noResults')"
    :clear-label="clearLabel"
    :label="label"
    :hint="hint"
    :error="error"
    :required="required"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
