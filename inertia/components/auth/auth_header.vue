<script setup lang="ts">
/**
 * En-tête des écrans focalisés (layout `auth.vue`) : titre `text-display-md` et
 * description. Le slot par défaut accueille une précision supplémentaire.
 */
withDefaults(defineProps<{ title: string; description?: string }>(), { description: '' })
</script>

<template>
  <div class="flex flex-col gap-2">
    <h1 class="text-display-md">{{ title }}</h1>
    <p v-if="description" class="text-body-md text-text-secondary">{{ description }}</p>
    <slot />
  </div>
</template>
