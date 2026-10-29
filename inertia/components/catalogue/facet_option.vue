<script setup lang="ts">
/**
 * Contenu d'une case de facette : pastille de couleur optionnelle (`hex`),
 * libellé et compteur tabulaire. `count` à `null` = pas de compteur affiché
 * (moteur de recherche indisponible).
 */
withDefaults(
  defineProps<{
    label: string
    count?: number | null
    hex?: string | null
  }>(),
  { count: null, hex: null }
)
</script>

<template>
  <span class="flex items-center gap-2">
    <span
      v-if="hex"
      class="inline-block size-3.5 shrink-0 rounded-full border border-input"
      :style="{ backgroundColor: hex }"
      aria-hidden="true"
    />
    <span>{{ label }}</span>
    <span v-if="count !== null" class="text-tabular text-caption text-text-muted">{{ count }}</span>
  </span>
</template>
