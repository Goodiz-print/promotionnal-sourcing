<script setup lang="ts">
import { computed } from 'vue'

/**
 * Carte du design system : blanche, `rounded-xl`, bordure hairline, ombre légère.
 * `hover` la soulève au survol (cartes cliquables), `padding` fixe l'espacement interne.
 */
const props = withDefaults(
  defineProps<{
    as?: 'div' | 'section' | 'article' | 'fieldset' | 'li'
    variant?: 'default' | 'sunken' | 'brand' | 'dark'
    padding?: 'none' | 'sm' | 'md' | 'lg'
    hover?: boolean
  }>(),
  { as: 'div', variant: 'default', padding: 'none', hover: false }
)

const VARIANT_CLASSES: Record<NonNullable<typeof props.variant>, string> = {
  default: 'border border-hairline bg-card shadow-elevation-1',
  sunken: 'border border-hairline bg-sunken',
  brand: 'bg-indigo-500 text-white shadow-elevation-1',
  dark: 'bg-ink-950 text-white shadow-elevation-1',
}

const PADDING_CLASSES: Record<NonNullable<typeof props.padding>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

const classes = computed(() => [
  'min-w-0 rounded-xl',
  VARIANT_CLASSES[props.variant],
  PADDING_CLASSES[props.padding],
  props.hover
    ? 'transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-elevation-2'
    : '',
])
</script>

<template>
  <component :is="as" :class="classes">
    <slot />
  </component>
</template>
