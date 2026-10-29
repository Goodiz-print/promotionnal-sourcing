<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'

/**
 * Onglets de navigation (liens) soulignés : l'onglet courant porte `aria-current`.
 * Le slot `actions` place un lien ou un bouton à droite de la barre.
 */
defineProps<{
  items: { href: string; label: string; active: boolean; count?: number }[]
  label: string
}>()
</script>

<template>
  <nav :aria-label="label" class="flex items-center gap-1 border-b border-hairline">
    <div class="-mb-px flex items-center gap-1 overflow-x-auto">
      <Link
        v-for="item in items"
        :key="item.href"
        :href="item.href"
        :aria-current="item.active ? 'page' : undefined"
        class="font-heading inline-flex items-center gap-2 border-b-2 px-3 py-3 text-body-sm font-semibold whitespace-nowrap transition-colors duration-150"
        :class="
          item.active
            ? 'border-indigo-500 text-indigo-600'
            : 'border-transparent text-text-secondary hover:border-strong hover:text-text-primary'
        "
      >
        {{ item.label }}
        <span
          v-if="item.count !== undefined"
          class="text-tabular rounded-pill bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-700"
        >
          {{ item.count }}
        </span>
      </Link>
    </div>
    <div v-if="$slots.actions" class="ml-auto flex items-center gap-2 pb-2">
      <slot name="actions" />
    </div>
  </nav>
</template>
