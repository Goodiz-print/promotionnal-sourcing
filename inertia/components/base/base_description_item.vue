<script setup lang="ts">
/** Paire clé / valeur à placer dans `BaseDescriptionList` ; `full` l'étale sur toutes les colonnes. */
withDefaults(defineProps<{ label: string; full?: boolean }>(), { full: false })
</script>

<template>
  <div :class="full ? 'sm:col-span-full' : ''">
    <dt class="text-caption font-semibold text-text-muted">{{ label }}</dt>
    <dd class="mt-0.5 text-body-sm text-text-primary"><slot /></dd>
  </div>
</template>
