<script setup lang="ts">
import { computed } from 'vue'
import type { BadgeTone } from '~/types/ui'

/**
 * Pastille d'état (pill), paramétrée par une tonalité sémantique. `dot` ajoute un
 * point coloré devant le libellé ; `brand` est la chip indigo de la landing.
 */
const props = withDefaults(
  defineProps<{
    tone?: BadgeTone | 'brand'
    dot?: boolean
  }>(),
  { tone: 'neutral', dot: false }
)

const TONE_CLASSES: Record<NonNullable<typeof props.tone>, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  info: 'bg-indigo-50 text-indigo-700',
  brand: 'bg-brand-subtle text-indigo-600',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
}

const DOT_CLASSES: Record<NonNullable<typeof props.tone>, string> = {
  neutral: 'bg-ink-400',
  info: 'bg-indigo-500',
  brand: 'bg-indigo-500',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

const toneClass = computed(() => TONE_CLASSES[props.tone])
const dotClass = computed(() => DOT_CLASSES[props.tone])
</script>

<template>
  <span
    :class="toneClass"
    class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap"
  >
    <span v-if="dot" :class="dotClass" class="size-1.5 rounded-full" aria-hidden="true" />
    <slot />
  </span>
</template>
