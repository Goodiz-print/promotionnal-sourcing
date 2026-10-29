<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import BaseButton from '~/components/base/base_button.vue'
import type { PaginationMeta } from '#shared/types/pagination'

/**
 * Pager précédent / suivant d'une liste paginée côté serveur. Masqué s'il n'y a
 * qu'une page ; le parent décide quoi faire du numéro de page (`change`).
 */
defineProps<{
  meta: PaginationMeta
  previousLabel: string
  nextLabel: string
}>()

defineEmits<{
  change: [page: number]
}>()
</script>

<template>
  <nav v-if="meta.lastPage > 1" class="flex items-center justify-center gap-4">
    <BaseButton
      variant="secondary"
      size="sm"
      :disabled="meta.currentPage <= 1"
      @click="$emit('change', meta.currentPage - 1)"
    >
      <template #icon><ChevronLeft :size="16" aria-hidden="true" /></template>
      {{ previousLabel }}
    </BaseButton>
    <span class="text-tabular text-caption text-text-muted">
      {{ meta.currentPage }} / {{ meta.lastPage }}
    </span>
    <BaseButton
      variant="secondary"
      size="sm"
      :disabled="meta.currentPage >= meta.lastPage"
      @click="$emit('change', meta.currentPage + 1)"
    >
      {{ nextLabel }}
      <ChevronRight :size="16" aria-hidden="true" />
    </BaseButton>
  </nav>
</template>
