<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Inbox } from 'lucide-vue-next'

/** État vide d'une liste ou d'une section : icône, titre, description, actions. */
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: Component
    compact?: boolean
  }>(),
  { description: '', icon: undefined, compact: false }
)

/* Les icônes lucide sont des composants fonctionnels : Vue les appellerait comme
   fabrique de valeur par défaut, d'où le repli calculé plutôt qu'un `default`. */
const iconComponent = computed(() => props.icon ?? Inbox)
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-input bg-sunken text-center"
    :class="compact ? 'px-6 py-8' : 'px-6 py-14'"
  >
    <span
      class="flex size-12 items-center justify-center rounded-full bg-brand-subtle text-indigo-600"
      aria-hidden="true"
    >
      <component :is="iconComponent" :size="22" />
    </span>
    <div class="flex max-w-[420px] flex-col gap-1">
      <p class="text-heading-md text-text-primary">{{ title }}</p>
      <p v-if="description" class="text-body-sm text-text-secondary">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="mt-2 flex flex-wrap items-center justify-center gap-3">
      <slot name="actions" />
    </div>
  </div>
</template>
