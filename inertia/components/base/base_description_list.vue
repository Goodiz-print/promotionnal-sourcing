<script setup lang="ts">
/**
 * Liste clé / valeur (fiche produit, fournisseur, commande…). `items` rend les
 * paires simples ; le slot par défaut accepte des paires supplémentaires rendues
 * avec `BaseDescriptionItem`. `columns` fixe le nombre de colonnes à partir de `sm`.
 */
withDefaults(
  defineProps<{
    items?: { label: string; value: string | number | null | undefined }[]
    columns?: 1 | 2 | 3
  }>(),
  { items: () => [], columns: 2 }
)

const COLUMN_CLASSES: Record<1 | 2 | 3, string> = {
  1: '',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
}
</script>

<template>
  <dl class="grid gap-x-6 gap-y-4" :class="COLUMN_CLASSES[columns]">
    <template v-for="item in items" :key="item.label">
      <div v-if="item.value !== null && item.value !== undefined && item.value !== ''">
        <dt class="text-caption font-semibold text-text-muted">{{ item.label }}</dt>
        <dd class="mt-0.5 text-body-sm text-text-primary">{{ item.value }}</dd>
      </div>
    </template>
    <slot />
  </dl>
</template>
