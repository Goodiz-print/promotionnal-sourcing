<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    htmlFor?: string
    error?: string
  }>(),
  { label: '', htmlFor: undefined, error: '' }
)
</script>

<template>
  <div>
    <label v-if="label" :for="htmlFor" class="mb-1 block text-sm font-medium">{{ label }}</label>
    <slot />
    <div v-if="error" class="mt-0.5 text-sm font-medium text-[#fb2c36]">{{ error }}</div>
  </div>
</template>
