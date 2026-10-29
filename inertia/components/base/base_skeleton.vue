<script setup lang="ts">
/**
 * Bloc de chargement du design system : fond `bg-sunken` balayé par un reflet doux
 * (`skeleton`, désactivé si l'utilisateur préfère moins d'animations). La forme se
 * règle par les classes du parent (`h-4 w-2/3`, `aspect-square`, `rounded-pill`…).
 */
withDefaults(defineProps<{ shape?: 'md' | 'pill' }>(), { shape: 'md' })
</script>

<template>
  <div
    class="skeleton"
    :class="shape === 'pill' ? 'rounded-pill' : 'rounded-md'"
    aria-hidden="true"
  />
</template>
