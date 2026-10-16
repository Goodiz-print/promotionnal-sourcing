<script setup lang="ts">
import BaseCard from '~/components/base_card.vue'
import FxCanvas from '~/components/marketing/fx_canvas.vue'
import { useMarketing } from '~/composables/use_marketing'

const { t } = useMarketing()

/* Noms de fournisseurs fictifs de la démo : ce sont des noms propres, pas du texte traduit. */
const LEGEND = [
  { label: 'Recyfil', price: '0,98 €', color: 'bg-indigo-500', textClass: 'text-indigo-600' },
  { label: 'EcoBag', price: '1,24 €', color: 'bg-ink-300', textClass: '' },
  { label: 'Jute&Co', price: '1,89 €', color: 'bg-ink-200', textClass: '' },
]
</script>

<template>
  <BaseCard
    data-reveal
    hover
    class="group col-span-2 flex flex-col p-6 md:col-span-3"
    style="transition-delay: 0.1s"
  >
    <p class="mb-1.5 text-heading-md">{{ t('landing.features.compare.title') }}</p>
    <p class="mb-4 text-body-sm text-text-secondary">
      {{ t('landing.features.compare.description') }}
    </p>
    <div class="relative min-h-[96px] flex-1">
      <FxCanvas kind="chart" />
    </div>
    <div class="mt-2.5 flex flex-wrap gap-3.5">
      <span
        v-for="item in LEGEND"
        :key="item.label"
        class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-muted"
      >
        <span class="inline-block h-2 w-2 rounded-full" :class="item.color" />
        {{ item.label }} ·
        <span class="text-tabular" :class="item.textClass">{{ item.price }}</span>
      </span>
    </div>
    <p class="mt-4 text-caption font-semibold text-indigo-600">
      {{ t('landing.features.compare.button') }} <span class="bento-arrow">→</span>
    </p>
  </BaseCard>
</template>
