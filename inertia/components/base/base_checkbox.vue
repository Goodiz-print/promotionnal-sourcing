<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: boolean
    label?: string
    description?: string
    disabled?: boolean
  }>(),
  { label: '', description: '', disabled: false }
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
  <label
    :for="id"
    class="flex cursor-pointer items-start gap-2.5 text-body-sm text-text-primary"
    :class="disabled ? 'cursor-not-allowed opacity-50' : ''"
  >
    <input
      :id="id"
      v-model="model"
      type="checkbox"
      :disabled="disabled"
      class="mt-0.5 size-4 shrink-0 cursor-pointer rounded-xs border-input accent-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
    />
    <span class="flex flex-col">
      <span v-if="label">{{ label }}</span>
      <slot />
      <span v-if="description" class="text-caption text-text-muted">{{ description }}</span>
    </span>
  </label>
</template>
