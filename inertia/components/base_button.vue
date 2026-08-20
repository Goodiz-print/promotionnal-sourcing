<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    type?: 'button' | 'submit'
    variant?: 'primary' | 'secondary' | 'link' | 'danger'
    disabled?: boolean
  }>(),
  { type: 'button', variant: 'primary', disabled: false }
)

const VARIANT_CLASSES: Record<NonNullable<typeof props.variant>, string> = {
  primary:
    'w-full cursor-pointer rounded bg-[var(--color-primary)] p-2.5 font-medium text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]',
  secondary:
    'shrink-0 cursor-pointer rounded border border-[var(--gray-4)] px-3 text-sm font-medium hover:bg-[var(--gray-2)]',
  link: 'cursor-pointer text-sm font-medium text-[var(--color-primary)] hover:underline',
  danger:
    'shrink-0 cursor-pointer rounded border border-[var(--state-danger)] px-3 py-2 text-sm font-medium text-[var(--state-danger)] hover:bg-[var(--state-danger-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--state-danger)]',
}

const variantClass = computed(() => VARIANT_CLASSES[props.variant])
</script>

<template>
  <button :type="type" :disabled="disabled" :class="variantClass">
    <slot />
  </button>
</template>
