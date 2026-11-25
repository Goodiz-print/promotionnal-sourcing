<script setup lang="ts">
/**
 * Pastille de compteur posée dans le coin d'un bouton icône du bandeau
 * (notifications, panier de devis). Le parent doit être `relative`. Au-delà de
 * 99, affiche « 99+ ». Rien n'est rendu à zéro.
 */
withDefaults(defineProps<{ count: number; label: string; tone?: 'danger' | 'brand' }>(), {
  tone: 'danger',
})
</script>

<template>
  <span
    v-if="count > 0"
    class="text-tabular absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-pill px-1 text-caption leading-none font-semibold text-white"
    :class="tone === 'brand' ? 'bg-indigo-600' : 'bg-danger'"
    :aria-label="label"
  >
    {{ count > 99 ? '99+' : count }}
  </span>
</template>
