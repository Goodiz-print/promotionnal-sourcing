<script setup lang="ts">
/**
 * Zone des actions irréversibles (supprimer un compte, archiver une organisation…) :
 * carte à bordure rouge, titre en danger, sous-titre, puis le contenu du slot
 * (une ou plusieurs actions, chacune en `flex items-start justify-between gap-6`).
 */
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <section
    class="flex min-w-0 flex-col overflow-hidden rounded-xl border border-danger/30 bg-card shadow-elevation-1"
  >
    <div class="flex flex-col gap-0.5 border-b border-danger/20 bg-danger-bg/40 px-6 py-4">
      <h2 class="text-heading-md text-danger">{{ title }}</h2>
      <p v-if="description" class="text-body-sm text-text-secondary">{{ description }}</p>
    </div>
    <div class="flex flex-col gap-6 p-6">
      <slot />
    </div>
  </section>
</template>
