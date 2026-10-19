<script setup lang="ts">
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
  <div v-if="meta.lastPage > 1" class="flex items-center justify-center gap-4">
    <BaseButton
      variant="secondary"
      :disabled="meta.currentPage <= 1"
      @click="$emit('change', meta.currentPage - 1)"
    >
      {{ previousLabel }}
    </BaseButton>
    <span class="text-sm text-[var(--gray-6)]">{{ meta.currentPage }} / {{ meta.lastPage }}</span>
    <BaseButton
      variant="secondary"
      :disabled="meta.currentPage >= meta.lastPage"
      @click="$emit('change', meta.currentPage + 1)"
    >
      {{ nextLabel }}
    </BaseButton>
  </div>
</template>
