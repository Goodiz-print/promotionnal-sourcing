<script setup lang="ts">
import { computed } from 'vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import { useRangeLabel } from '~/composables/use_range_label'
import type { NumericFacetBarType, NumericFacetBucketType } from '#shared/types/product'

const props = defineProps<{
  // Titre déjà localisé (« Prix », « Quantité minimum ») — texte de la légende.
  title: string
  // Préfixe stable (slug) des id de cases (« price », « moq ») — jamais le titre
  // localisé, qui contiendrait espaces/accents et produirait un id HTML invalide.
  idPrefix: string
  facet: NumericFacetBarType
  // Index des buckets cochés (dans la liste fermée partagée).
  selectedIndices: number[]
  // Unité / devise affichée après la borne (« € » pour le prix…). Optionnel.
  suffix?: string
}>()

const emit = defineEmits<{
  toggle: [index: number, checked: boolean]
}>()

const rangeLabel = useRangeLabel()

// Avec des compteurs, on masque les tranches à 0 — sauf celles déjà cochées, pour
// pouvoir les décocher. Sans compteur (moteur inerte), on affiche tout.
const visibleBuckets = computed<NumericFacetBucketType[]>(() =>
  props.facet.buckets.filter(
    (bucket) =>
      !props.facet.hasCounts ||
      bucket.count === null ||
      bucket.count > 0 ||
      props.selectedIndices.includes(bucket.index)
  )
)
</script>

<template>
  <fieldset v-if="visibleBuckets.length > 0" class="flex flex-col gap-2">
    <legend class="mb-1 text-sm font-medium">{{ title }}</legend>

    <BaseCheckbox
      v-for="bucket in visibleBuckets"
      :id="`numeric-${idPrefix}-${bucket.index}`"
      :key="bucket.index"
      :model-value="selectedIndices.includes(bucket.index)"
      @update:model-value="(checked) => emit('toggle', bucket.index, checked)"
    >
      <span class="flex flex-1 items-center gap-2">
        <span class="flex-1">{{ rangeLabel(bucket.minValue, bucket.maxValue, suffix) }}</span>
        <span v-if="facet.hasCounts && bucket.count !== null" class="text-xs text-[var(--gray-6)]">
          {{ bucket.count }}
        </span>
      </span>
    </BaseCheckbox>
  </fieldset>
</template>
