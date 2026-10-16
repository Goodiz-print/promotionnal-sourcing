<script setup lang="ts">
import BaseField from '~/components/base/base_field.vue'

withDefaults(
  defineProps<{
    id: string
    label?: string
    error?: string
    accept?: string
    multiple?: boolean
  }>(),
  { label: '', error: '', accept: 'image/*', multiple: false }
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
  <BaseField :label="label" :html-for="id" :error="error">
    <input
      :id="id"
      type="file"
      :accept="accept"
      :multiple="multiple"
      class="w-full rounded border border-[var(--gray-4)] p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-[var(--gray-2)] file:px-3 file:py-1 file:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
      @change="onChange"
    />
  </BaseField>
</template>
