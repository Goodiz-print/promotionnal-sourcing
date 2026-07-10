<script setup lang="ts">
import { computed } from 'vue'
import BaseField from '~/components/base_field.vue'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: string
    label?: string
    error?: string
    rows?: number
  }>(),
  { rows: 4, label: '', error: '' }
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
  <BaseField :label="label" :html-for="id" :error="error">
    <textarea
      :id="id"
      v-model="model"
      :rows="rows"
      :data-invalid="error ? 'true' : undefined"
      class="w-full rounded border border-[var(--gray-4)] px-4 py-2 data-[invalid=true]:border-[#fb2c36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
    />
  </BaseField>
</template>
