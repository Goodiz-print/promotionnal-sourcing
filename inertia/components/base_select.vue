<script setup lang="ts" generic="T extends string | number | null">
import { computed } from 'vue'
import BaseField from '~/components/base_field.vue'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: T
    label?: string
    error?: string
  }>(),
  { label: '', error: '' }
)

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()

const model = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
</script>

<template>
  <BaseField :label="label" :html-for="id" :error="error">
    <select
      :id="id"
      v-model="model"
      :data-invalid="error ? 'true' : undefined"
      class="h-10 w-full rounded border border-[var(--gray-4)] px-4 data-[invalid=true]:border-[#fb2c36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
    >
      <slot />
    </select>
  </BaseField>
</template>
