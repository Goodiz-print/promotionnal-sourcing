<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'
import { ArrowLeft } from 'lucide-vue-next'

/**
 * En-tête de page de l'application : lien retour optionnel, eyebrow, titre,
 * description, puis `meta` (badges, pills) sous le titre et `actions` à droite.
 */
withDefaults(
  defineProps<{
    title: string
    description?: string
    eyebrow?: string
    backHref?: string
    backLabel?: string
  }>(),
  { description: '', eyebrow: '', backHref: '', backLabel: '' }
)
</script>

<template>
  <header class="flex flex-col gap-4">
    <Link
      v-if="backHref"
      :href="backHref"
      class="inline-flex w-fit items-center gap-1.5 text-body-sm font-semibold text-text-secondary transition-colors hover:text-indigo-600"
    >
      <ArrowLeft :size="16" aria-hidden="true" />
      {{ backLabel }}
    </Link>
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="flex min-w-0 flex-col gap-1.5">
        <p v-if="eyebrow" class="text-eyebrow text-text-brand">{{ eyebrow }}</p>
        <h1 class="text-display-md text-text-primary">{{ title }}</h1>
        <p v-if="description" class="max-w-[640px] text-body-md text-text-secondary">
          {{ description }}
        </p>
        <div v-if="$slots.meta" class="mt-1 flex flex-wrap items-center gap-2">
          <slot name="meta" />
        </div>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-3">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
