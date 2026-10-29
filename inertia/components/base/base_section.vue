<script setup lang="ts">
import BaseCard from '~/components/base/base_card.vue'

/**
 * Section en carte : en-tête (titre, description, actions) séparé du corps par une
 * hairline. Sert aux blocs des pages détail et aux groupes de champs des formulaires.
 * `flush` retire le padding du corps (tableaux, listes bord à bord).
 */
withDefaults(
  defineProps<{
    title?: string
    description?: string
    flush?: boolean
    as?: 'section' | 'div' | 'fieldset'
  }>(),
  { title: '', description: '', flush: false, as: 'section' }
)
</script>

<template>
  <BaseCard :as="as" class="flex flex-col overflow-hidden">
    <div
      v-if="title || $slots.actions"
      class="flex flex-col gap-3 border-b border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex min-w-0 flex-col gap-0.5">
        <component :is="as === 'fieldset' ? 'legend' : 'h2'" class="text-heading-md">
          {{ title }}
        </component>
        <p v-if="description" class="text-body-sm text-text-secondary">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <div :class="flush ? '' : 'p-6'">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-hairline bg-sunken px-6 py-4">
      <slot name="footer" />
    </div>
  </BaseCard>
</template>
