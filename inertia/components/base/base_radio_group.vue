<script setup lang="ts" generic="T extends string">
import BaseField from '~/components/base/base_field.vue'

/** Groupe de cartes radio (une option par carte, sélection indigo claire). */
withDefaults(
  defineProps<{
    id: string
    modelValue?: T | null
    options: { value: T; label: string; description?: string }[]
    label?: string
    error?: string
    hint?: string
    required?: boolean
  }>(),
  { label: '', error: '', hint: '', required: false, modelValue: null }
)

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()
</script>

<template>
  <BaseField :label="label" :error="error" :hint="hint" :required="required">
    <div class="flex flex-col gap-3" role="radiogroup">
      <label
        v-for="option in options"
        :key="option.value"
        :data-selected="modelValue === option.value ? 'true' : undefined"
        class="flex cursor-pointer items-start gap-3 rounded-lg border border-input bg-canvas p-4 transition-colors duration-150 hover:border-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-500 data-[selected=true]:border-indigo-300 data-[selected=true]:bg-brand-subtle"
      >
        <input
          :id="`${id}-${option.value}`"
          type="radio"
          :name="id"
          :value="option.value"
          :checked="modelValue === option.value"
          class="mt-1 cursor-pointer accent-indigo-500"
          @change="emit('update:modelValue', option.value)"
        />
        <span class="flex flex-col gap-0.5">
          <span class="text-body-sm font-semibold text-text-primary">{{ option.label }}</span>
          <span v-if="option.description" class="text-caption text-text-secondary">
            {{ option.description }}
          </span>
        </span>
      </label>
    </div>
  </BaseField>
</template>
