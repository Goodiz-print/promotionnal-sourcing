<script setup lang="ts">
/**
 * Bouton carré réservé à une icône (topbar, actions de ligne). Le `label` est
 * obligatoire : il sert d'`aria-label` et de `title`.
 */
withDefaults(
  defineProps<{
    label: string
    type?: 'button' | 'submit'
    active?: boolean
  }>(),
  { type: 'button', active: false }
)
</script>

<template>
  <button
    :type="type"
    :aria-label="label"
    :title="label"
    :aria-pressed="active || undefined"
    class="relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-ink-100 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:pointer-events-none disabled:opacity-50"
    :class="active ? 'bg-brand-subtle text-indigo-600' : ''"
  >
    <slot />
  </button>
</template>
