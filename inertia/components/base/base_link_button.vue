<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@adonisjs/inertia/vue'
import {
  BUTTON_BASE_CLASSES,
  BUTTON_SIZE_CLASSES,
  BUTTON_VARIANT_CLASSES,
  type ButtonSize,
  type ButtonVariant,
} from '~/types/ui'

/**
 * Lien stylé en bouton : mêmes variantes et tailles que `BaseButton`, plus
 * `on-dark` (bouton blanc sur fond indigo / dégradé, landing). Chemin interne :
 * navigation Inertia ; ancres, mailto: et liens externes restent des `<a>`.
 */
const props = withDefaults(
  defineProps<{
    href: string
    variant?: ButtonVariant | 'on-dark'
    size?: ButtonSize | 'lg'
    block?: boolean
  }>(),
  { variant: 'primary', size: 'md', block: false }
)

const EXTRA_VARIANT_CLASSES: Record<'on-dark', string> = {
  'on-dark': 'bg-white text-indigo-600 hover:-translate-y-0.5 active:scale-[0.97]',
}

const EXTRA_SIZE_CLASSES: Record<'lg', string> = {
  lg: 'px-7 py-3.5 text-body-md',
}

const variantClass = computed(() =>
  props.variant === 'on-dark'
    ? EXTRA_VARIANT_CLASSES['on-dark']
    : BUTTON_VARIANT_CLASSES[props.variant]
)

const sizeClass = computed(() => {
  if (props.variant === 'link') return ''
  return props.size === 'lg' ? EXTRA_SIZE_CLASSES.lg : BUTTON_SIZE_CLASSES[props.size]
})

const isInternal = computed(() => props.href.startsWith('/') && !props.href.includes('#'))
</script>

<template>
  <component
    :is="isInternal ? Link : 'a'"
    :href="href"
    :class="[BUTTON_BASE_CLASSES, variantClass, sizeClass, block ? 'w-full' : '']"
  >
    <slot />
  </component>
</template>
