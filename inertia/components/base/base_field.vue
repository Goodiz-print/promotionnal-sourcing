<script setup lang="ts">
import { computed } from 'vue'

/**
 * Enveloppe label / contrôle / aide / erreur. L'erreur est annoncée (`role="alert"`)
 * et reliée au contrôle via `aria-describedby` quand le parent passe `describedBy`
 * (= `errorId`). `required` ajoute l'astérisque au label.
 */
const props = withDefaults(
  defineProps<{
    label?: string
    htmlFor?: string
    error?: string
    hint?: string
    required?: boolean
  }>(),
  { label: '', htmlFor: undefined, error: '', hint: '', required: false }
)

const errorId = computed(() => (props.htmlFor ? `${props.htmlFor}-error` : undefined))
const hintId = computed(() => (props.htmlFor ? `${props.htmlFor}-hint` : undefined))
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="htmlFor" class="text-body-sm font-semibold text-text-primary">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>
    <slot :error-id="errorId" :hint-id="hintId" />
    <p v-if="hint && !error" :id="hintId" class="text-caption text-text-muted">{{ hint }}</p>
    <p v-if="error" :id="errorId" role="alert" class="text-caption font-medium text-danger">
      {{ error }}
    </p>
  </div>
</template>
