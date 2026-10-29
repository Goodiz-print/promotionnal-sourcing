<script setup lang="ts">
import { computed } from 'vue'

/** Avatar à initiales (pastille indigo claire). */
const props = withDefaults(
  defineProps<{
    initials: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md' }
)

const SIZE_CLASSES: Record<NonNullable<typeof props.size>, string> = {
  sm: 'size-8 text-caption',
  md: 'size-9 text-body-sm',
  lg: 'size-12 text-body-md',
}

const sizeClass = computed(() => SIZE_CLASSES[props.size])
</script>

<template>
  <span
    :class="sizeClass"
    class="font-heading inline-flex shrink-0 items-center justify-center rounded-full bg-brand-subtle font-semibold text-indigo-700 uppercase select-none"
    aria-hidden="true"
  >
    {{ initials }}
  </span>
</template>
