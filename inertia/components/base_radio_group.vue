<script setup lang="ts" generic="T extends string">
import BaseField from '~/components/base_field.vue'

withDefaults(
  defineProps<{
    id: string
    modelValue?: T | null
    options: { value: T; label: string; description?: string }[]
    label?: string
    error?: string
  }>(),
  { label: '', error: '', modelValue: null }
)

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()
</script>

<template>
  <BaseField :label="label" :error="error">
    <div class="flex flex-col gap-3">
      <label
        v-for="option in options"
        :key="option.value"
        :data-selected="modelValue === option.value ? 'true' : undefined"
        class="flex cursor-pointer items-start gap-3 rounded border border-[var(--gray-4)] p-4 data-[selected=true]:border-[var(--color-primary)] data-[selected=true]:bg-[var(--gray-2)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--primary-6)]"
      >
        <input
          :id="`${id}-${option.value}`"
          type="radio"
          :name="id"
          :value="option.value"
          :checked="modelValue === option.value"
          class="mt-1 cursor-pointer accent-[var(--color-primary)]"
          @change="emit('update:modelValue', option.value)"
        />
        <span class="flex flex-col">
          <span class="font-medium">{{ option.label }}</span>
          <span v-if="option.description" class="text-sm text-[var(--gray-6)]">
            {{ option.description }}
          </span>
        </span>
      </label>
    </div>
  </BaseField>
</template>
