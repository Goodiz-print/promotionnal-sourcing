<script setup lang="ts">
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import {
  BUTTON_BASE_CLASSES,
  BUTTON_SIZE_CLASSES,
  BUTTON_VARIANT_CLASSES,
  ICON_SIZE,
  type ButtonSize,
  type ButtonVariant,
} from '~/types/ui'

/**
 * Bouton du design system (pill, Manrope). `block` l'étire sur toute la largeur
 * (formulaires d'authentification), `loading` affiche un spinner et désactive le
 * bouton. Le slot `icon` reçoit une icône lucide placée avant le libellé.
 */
const props = withDefaults(
  defineProps<{
    type?: 'button' | 'submit'
    variant?: ButtonVariant
    size?: ButtonSize
    block?: boolean
    loading?: boolean
    disabled?: boolean
  }>(),
  { type: 'button', variant: 'primary', size: 'md', block: false, loading: false, disabled: false }
)

const classes = computed(() => [
  BUTTON_BASE_CLASSES,
  BUTTON_VARIANT_CLASSES[props.variant],
  props.variant === 'link' ? '' : BUTTON_SIZE_CLASSES[props.size],
  props.block ? 'w-full' : '',
])
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :class="classes"
  >
    <Loader2 v-if="loading" :size="ICON_SIZE" class="animate-spin" aria-hidden="true" />
    <slot v-else name="icon" />
    <slot />
  </button>
</template>
