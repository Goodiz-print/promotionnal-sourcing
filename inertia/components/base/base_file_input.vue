<script setup lang="ts">
import { Upload } from 'lucide-vue-next'
import BaseField from '~/components/base/base_field.vue'

/**
 * Zone de dépôt de fichiers : le `<input type="file">` natif est recouvert d'un
 * cadre en pointillés cliquable ; le glisser-déposer est pris en charge nativement.
 */
withDefaults(
  defineProps<{
    id: string
    label?: string
    error?: string
    hint?: string
    accept?: string
    multiple?: boolean
    prompt?: string
  }>(),
  { label: '', error: '', hint: '', accept: 'image/*', multiple: false, prompt: '' }
)

const emit = defineEmits<{ change: [files: File[]] }>()

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  emit('change', input.files ? Array.from(input.files) : [])
  // Réinitialise pour permettre de re-sélectionner le même fichier.
  input.value = ''
}
</script>

<template>
  <BaseField :label="label" :html-for="id" :error="error" :hint="hint">
    <label
      :for="id"
      class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-sunken px-4 py-6 text-center transition-colors duration-150 hover:border-indigo-300 hover:bg-brand-subtle focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-500"
    >
      <span
        class="flex size-10 items-center justify-center rounded-[10px] bg-brand-subtle text-indigo-600"
        aria-hidden="true"
      >
        <Upload :size="18" />
      </span>
      <span v-if="prompt" class="text-body-sm font-semibold text-text-primary">{{ prompt }}</span>
      <input
        :id="id"
        type="file"
        :accept="accept"
        :multiple="multiple"
        class="sr-only"
        @change="onChange"
      />
    </label>
  </BaseField>
</template>
