<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: boolean
    label?: string
  }>(),
  { label: '' }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const model = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
</script>

<template>
  <label :for="id" class="flex cursor-pointer items-center gap-2 text-sm">
    <input
      :id="id"
      v-model="model"
      type="checkbox"
      class="h-4 w-4 rounded border-[var(--gray-4)] accent-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
    />
    <span v-if="label">{{ label }}</span>
    <slot />
  </label>
</template>
