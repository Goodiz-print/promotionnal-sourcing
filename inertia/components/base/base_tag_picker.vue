<script setup lang="ts" generic="T extends string">
import { computed, ref } from 'vue'
import { X } from 'lucide-vue-next'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseSelect from '~/components/base/base_select.vue'

/**
 * Sélection multiple dans une longue liste (pays, langues) : un select pour
 * ajouter une valeur, les valeurs choisies en badges retirables. Le `v-model`
 * garde le type des valeurs (`T[]`).
 */
const props = withDefaults(
  defineProps<{
    id: string
    modelValue: T[]
    options: { value: T; label: string }[]
    label?: string
    hint?: string
    error?: string
    /** Libellé de l'option vide du select (« Ajouter… »). */
    placeholder: string
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

const pending = ref('')

const labels = computed(() => new Map(props.options.map((option) => [option.value, option.label])))

const available = computed(() =>
  props.options.filter((option) => !props.modelValue.includes(option.value))
)

/** Le select ne propose que des valeurs de `options` (ou l'option vide). */
function add(raw: string) {
  pending.value = ''
  const value = raw as T
  if (raw === '' || props.modelValue.includes(value)) return
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
    <BaseSelect
      :id="id"
      :model-value="pending"
      :label="label"
      :hint="hint"
      :error="error"
      @update:model-value="add"
    >
      <option value="">{{ placeholder }}</option>
      <option v-for="option in available" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </BaseSelect>

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
