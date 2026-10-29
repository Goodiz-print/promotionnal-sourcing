<script setup lang="ts">
import type { Component } from 'vue'
import { Link } from '@adonisjs/inertia/vue'
import { ArrowUpRight } from 'lucide-vue-next'
import BaseCard from '~/components/base/base_card.vue'

/**
 * Compteur libellé / valeur d'un tableau de bord. `icon` (composant lucide) s'affiche
 * dans une pastille indigo claire, `hint` précise la valeur, `href` rend la carte
 * cliquable (navigation Inertia).
 */
defineProps<{
  label: string
  value: string | number
  hint?: string
  icon?: Component
  href?: string
}>()
</script>

<template>
  <component :is="href ? Link : 'div'" :href="href" class="group block">
    <BaseCard padding="md" :hover="Boolean(href)" class="flex h-full items-start gap-4">
      <span
        v-if="icon"
        class="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-subtle text-indigo-600"
        aria-hidden="true"
      >
        <component :is="icon" :size="20" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="text-caption font-semibold text-text-muted">{{ label }}</span>
        <span
          class="font-heading text-tabular mt-1 text-[28px] leading-none font-semibold text-text-primary"
        >
          {{ value }}
        </span>
        <span v-if="hint" class="mt-1.5 text-caption text-text-muted">{{ hint }}</span>
      </span>
      <ArrowUpRight
        v-if="href"
        :size="16"
        class="shrink-0 text-text-muted transition-colors group-hover:text-indigo-600"
        aria-hidden="true"
      />
    </BaseCard>
  </component>
</template>
