<script setup lang="ts">
/**
 * Compteur libellé/valeur d'un tableau de bord ; `hint` ajoute une précision
 * sous la valeur (ex. « sur 100 »).
 */
defineProps<{
  label: string
  value: string | number
  hint?: string
}>()
</script>

<template>
  <div class="rounded border border-[var(--gray-4)] p-5">
    <dt class="text-sm text-[var(--gray-6)]">{{ label }}</dt>
    <dd class="mt-1 text-3xl font-medium">{{ value }}</dd>
    <p v-if="hint" class="mt-1 text-xs text-[var(--gray-6)]">{{ hint }}</p>
  </div>
</template>
