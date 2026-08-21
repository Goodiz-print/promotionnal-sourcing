<script setup lang="ts">
import { computed } from 'vue'

/**
 * Pastille d'état, paramétrée par une tonalité sémantique — utilisée pour les
 * statuts de demande et de destinataire, réutilisable partout ailleurs.
 */
const props = withDefaults(
  defineProps<{
    tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  }>(),
  { tone: 'neutral' }
)

const TONE_CLASSES: Record<NonNullable<typeof props.tone>, string> = {
  neutral: 'bg-[var(--gray-3)] text-[var(--gray-10)]',
  info: 'bg-[var(--primary-3)] text-[var(--primary-11)]',
  success: 'bg-[var(--state-success-bg)] text-[var(--state-success)]',
  warning: 'bg-[var(--state-warning-bg)] text-[var(--state-warning)]',
  danger: 'bg-[var(--state-danger-bg)] text-[var(--state-danger)]',
}

const toneClass = computed(() => TONE_CLASSES[props.tone])
</script>

<template>
  <span
    :class="toneClass"
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
  >
    <slot />
  </span>
</template>
