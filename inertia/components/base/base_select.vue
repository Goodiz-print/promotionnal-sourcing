<script setup lang="ts" generic="T extends string | number | null">
import { computed } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import BaseField from '~/components/base/base_field.vue'

/** Select natif habillé (chevron lucide, même cadre que BaseInput). Slot = `<option>`. */
const props = withDefaults(
  defineProps<{
    id: string
    modelValue: T
    label?: string
    error?: string
    hint?: string
    /** Nom accessible quand aucun `label` visible n'est affiché (select en cellule de tableau). */
    ariaLabel?: string
    required?: boolean
    disabled?: boolean
  }>(),
  { label: '', error: '', hint: '', ariaLabel: undefined, required: false, disabled: false }
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
  <BaseField :label="label" :html-for="id" :error="error" :hint="hint" :required="required">
    <template #default="{ errorId, hintId }">
      <div class="relative flex items-center">
        <select
          :id="id"
          v-model="model"
          :disabled="disabled"
          :required="required"
          :aria-label="ariaLabel"
          :aria-invalid="error ? 'true' : undefined"
          :aria-describedby="error ? errorId : hint ? hintId : undefined"
          :data-invalid="error ? 'true' : undefined"
          class="field-control h-11 cursor-pointer appearance-none pr-10"
        >
          <slot />
        </select>
        <ChevronDown
          :size="16"
          class="pointer-events-none absolute right-3.5 text-text-muted"
          aria-hidden="true"
        />
      </div>
    </template>
  </BaseField>
</template>
