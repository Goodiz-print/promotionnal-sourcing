<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'brand' | 'dark'
    hover?: boolean
  }>(),
  { variant: 'default', hover: false }
)

const VARIANT_CLASSES: Record<NonNullable<typeof props.variant>, string> = {
  default: 'border border-hairline bg-card',
  brand: 'bg-indigo-500',
  dark: 'bg-ink-950',
}

const classes = computed(() => [
  'rounded-xl shadow-elevation-1',
  VARIANT_CLASSES[props.variant],
  props.hover
    ? 'transition-[transform,box-shadow] duration-250 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1.5 hover:shadow-elevation-2'
    : '',
])
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
