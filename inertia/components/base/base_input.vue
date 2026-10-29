<script setup lang="ts" generic="T extends string | number | null">
import { useSlots } from 'vue'
import BaseField from '~/components/base/base_field.vue'

/**
 * Champ texte / nombre / e-mail… du design system. Les slots `prefix` et `suffix`
 * accueillent une icône ou une unité à l'intérieur du cadre.
 */
const props = withDefaults(
  defineProps<{
    id: string
    modelValue: T
    label?: string
    type?: 'text' | 'number' | 'email' | 'password' | 'date' | 'url' | 'tel' | 'search'
    error?: string
    hint?: string
    required?: boolean
    disabled?: boolean
    min?: number | string
    max?: number | string
    step?: number | string
    placeholder?: string
    autocomplete?: string
  }>(),
  {
    type: 'text',
    label: '',
    error: '',
    hint: '',
    required: false,
    disabled: false,
    min: undefined,
    max: undefined,
    step: undefined,
    placeholder: '',
    autocomplete: '',
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()

const slots = useSlots()

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  const next = props.type === 'number' ? (value === '' ? null : Number(value)) : value
  emit('update:modelValue', next as T)
}
</script>

<template>
  <BaseField :label="label" :html-for="id" :error="error" :hint="hint" :required="required">
    <template #default="{ errorId, hintId }">
      <div class="relative flex items-center">
        <span
          v-if="slots.prefix"
          class="pointer-events-none absolute left-3.5 flex items-center text-text-muted"
        >
          <slot name="prefix" />
        </span>
        <input
          :id="id"
          :type="type"
          :value="modelValue"
          :min="min"
          :max="max"
          :step="step"
          :placeholder="placeholder"
          :autocomplete="autocomplete"
          :disabled="disabled"
          :required="required"
          :aria-invalid="error ? 'true' : undefined"
          :aria-describedby="error ? errorId : hint ? hintId : undefined"
          :data-invalid="error ? 'true' : undefined"
          class="field-control h-11"
          :class="[slots.prefix ? 'pl-10' : '', slots.suffix ? 'pr-10' : '']"
          @input="onInput"
        />
        <span
          v-if="slots.suffix"
          class="pointer-events-none absolute right-3.5 flex items-center text-text-muted"
        >
          <slot name="suffix" />
        </span>
      </div>
    </template>
  </BaseField>
</template>
