<script setup lang="ts" generic="D extends DocumentType">
import { formatFileSize } from '#shared/helpers/file_size'
import type { DocumentType } from '#shared/types/document'

defineProps<{
  documents: D[]
  /** Libellé affiché avant le nom du fichier (ex. nature du document). */
  labelFor?: (document: D) => string | null
}>()
</script>

<template>
  <ul class="flex flex-col gap-2">
    <li
      v-for="document in documents"
      :key="document.id"
      class="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-card px-3 py-2"
    >
      <div class="flex min-w-0 flex-col">
        <span v-if="labelFor?.(document)" class="text-caption text-text-muted">
          {{ labelFor(document) }}
        </span>
        <a
          :href="document.url"
          target="_blank"
          rel="noopener"
          class="truncate text-body-sm font-semibold text-indigo-600 hover:underline"
        >
          {{ document.originalName }}
        </a>
      </div>
      <div class="flex shrink-0 items-center gap-3">
        <span class="text-caption text-text-muted">{{ formatFileSize(document.sizeBytes) }}</span>
        <slot name="actions" :document="document" />
      </div>
    </li>
  </ul>
</template>
