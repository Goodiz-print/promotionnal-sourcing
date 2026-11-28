<script setup lang="ts" generic="T extends string">
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseCombobox from '~/components/base/base_combobox.vue'

/**
 * Sélection multiple dans une longue liste (pays, langues) : une liste avec
 * recherche pour ajouter une valeur, les valeurs choisies en badges retirables.
 * Le `v-model` garde le type des valeurs (`T[]`).
 */
const props = withDefaults(
  defineProps<{
    id: string
    modelValue: T[]
    options: { value: T; label: string }[]
    label?: string
    hint?: string
    error?: string
    /** Texte du bouton d'ajout (« Ajouter… »). */
    placeholder: string
    /** Nom accessible et placeholder du champ de recherche. */
    searchLabel: string
    noResultsLabel: string
    /** Nom accessible du bouton de retrait d'une valeur. */
    removeLabel: (label: string) => string
    /** Texte affiché quand rien n'est choisi. */
    emptyLabel?: string
  }>(),
  { label: '', hint: '', error: '', emptyLabel: '' }
)

const emit = defineEmits<{
  'update:modelValue': [value: T[]]
}>()

const labels = computed(() => new Map(props.options.map((option) => [option.value, option.label])))

const available = computed(() =>
  props.options.filter((option) => !props.modelValue.includes(option.value))
)

function add(value: T | null) {
  if (value === null || props.modelValue.includes(value)) return
  emit('update:modelValue', [...props.modelValue, value])
}

function remove(value: T) {
  emit(
    'update:modelValue',
    props.modelValue.filter((item) => item !== value)
  )
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <BaseCombobox
      :id="id"
      :model-value="null"
      :options="available"
      :placeholder="placeholder"
      :search-label="searchLabel"
      :no-results-label="noResultsLabel"
      :label="label"
      :hint="hint"
      :error="error"
      @update:model-value="add"
    />

    <ul v-if="modelValue.length > 0" class="flex flex-wrap gap-1.5">
      <li v-for="value in modelValue" :key="value">
        <BaseBadge tone="neutral">
          {{ labels.get(value) ?? value }}
          <button
            type="button"
            class="-mr-1 inline-flex cursor-pointer items-center rounded-xs text-text-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-indigo-500"
            :aria-label="removeLabel(labels.get(value) ?? value)"
            @click="remove(value)"
          >
            <X :size="12" aria-hidden="true" />
          </button>
        </BaseBadge>
      </li>
    </ul>
    <p v-else-if="emptyLabel" class="text-caption text-text-muted">{{ emptyLabel }}</p>
  </div>
</template>
