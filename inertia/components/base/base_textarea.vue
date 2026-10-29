<script setup lang="ts">
import { computed } from 'vue'
import BaseField from '~/components/base/base_field.vue'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: string
    label?: string
    error?: string
    hint?: string
    required?: boolean
    disabled?: boolean
    placeholder?: string
    rows?: number
  }>(),
  {
    rows: 4,
    label: '',
    error: '',
    hint: '',
    required: false,
    disabled: false,
    placeholder: '',
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const model = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
</script>

<template>
  <BaseField :label="label" :html-for="id" :error="error" :hint="hint" :required="required">
    <template #default="{ errorId, hintId }">
      <textarea
        :id="id"
        v-model="model"
        :rows="rows"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? errorId : hint ? hintId : undefined"
        :data-invalid="error ? 'true' : undefined"
        class="field-control resize-y"
      />
    </template>
  </BaseField>
</template>
