<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@adonisjs/inertia/vue'

const props = withDefaults(
  defineProps<{
    href: string
    variant?: 'primary' | 'secondary' | 'on-dark'
  }>(),
  { variant: 'primary' }
)

const VARIANT_CLASSES: Record<NonNullable<typeof props.variant>, string> = {
  'primary': 'bg-indigo-500 text-white hover:bg-indigo-600 active:scale-[0.94]',
  'secondary':
    'border border-input bg-canvas text-text-primary hover:bg-ink-50 active:scale-[0.94]',
  'on-dark': 'bg-white text-indigo-600 hover:-translate-y-0.5 active:scale-[0.94]',
}

/** Chemin interne (navigation Inertia) ; ancres, mailto: et liens externes restent des <a>. */
const isInternal = computed(() => props.href.startsWith('/') && !props.href.includes('#'))
</script>

<template>
  <component
    :is="isInternal ? Link : 'a'"
    :href="href"
    class="font-heading inline-block rounded-pill px-7 py-3.5 text-body-md font-semibold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
    :class="VARIANT_CLASSES[variant]"
  >
    <slot />
  </component>
</template>
