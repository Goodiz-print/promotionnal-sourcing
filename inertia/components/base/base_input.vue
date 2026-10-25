<script setup lang="ts" generic="T extends string | number | null">
import BaseField from '~/components/base/base_field.vue'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: T
    label?: string
    type?: 'text' | 'number' | 'email' | 'password' | 'date'
    error?: string
    min?: number | string
    placeholder?: string
    autocomplete?: string
  }>(),
  { type: 'text', label: '', error: '', min: undefined, placeholder: '', autocomplete: '' }
)

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  const next = props.type === 'number' ? (value === '' ? null : Number(value)) : value
  emit('update:modelValue', next as T)
}
</script>

<template>
  <BaseField :label="label" :html-for="id" :error="error">
    <input
      :id="id"
      :type="type"
      :value="modelValue"
      :min="min"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :data-invalid="error ? 'true' : undefined"
      class="h-10 w-full rounded border border-[var(--gray-4)] px-4 data-[invalid=true]:border-[#fb2c36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
      @input="onInput"
    />
  </BaseField>
</template>
