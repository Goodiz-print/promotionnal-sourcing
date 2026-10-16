<script setup lang="ts">
import BaseCard from '~/components/base_card.vue'
import FxCanvas from '~/components/marketing/fx_canvas.vue'
import { useMarketing } from '~/composables/use_marketing'

const { t } = useMarketing()

const RESULTS = [
  { index: 0, price: '1,24 €', image: '/img/CGB2601_PHOTO_0.jpg' },
  { index: 1, price: '0,98 €', image: '/img/impr_1458560-PDP_25.webp' },
]
</script>

<template>
  <BaseCard
    data-reveal
    hover
    class="group col-span-2 flex flex-col p-7 md:col-span-3 md:row-span-2"
  >
    <p class="mb-2 text-heading-lg">{{ t('landing.features.search.title') }}</p>
    <p class="mb-5 text-body-md text-text-secondary">
      {{ t('landing.features.search.description') }}
    </p>
    <div
      class="relative flex-1 overflow-hidden rounded-md border border-hairline bg-sunken p-[18px]"
    >
      <FxCanvas kind="search-field" />
      <div class="relative z-10 flex h-full flex-col gap-2.5">
        <div
          class="flex items-center gap-2 self-start rounded-[14px] rounded-bl-[4px] border border-indigo-300 bg-white px-3.5 py-2.5 shadow-[0_0_0_3px_var(--surface-brand-subtle)]"
        >
          <span class="text-body-sm font-medium text-text-primary">{{
            t('landing.features.search.query')
          }}</span>
          <span class="anim-caret h-[15px] w-0.5 bg-indigo-500" />
        </div>
        <div
          class="max-w-[92%] self-start rounded-[14px] rounded-bl-[4px] bg-brand-subtle px-3.5 py-2.5 text-body-sm font-medium text-indigo-600"
        >
          {{ t('landing.features.search.matchLabel') }}
        </div>
        <div class="mt-0.5 grid grid-cols-2 gap-2.5">
          <div
            v-for="result in RESULTS"
            :key="result.index"
            class="bento-product-card flex flex-col gap-1 rounded-sm border border-hairline bg-white p-2.5 shadow-elevation-1"
          >
            <div
              class="mb-0.5 flex aspect-[3/4] items-center justify-center overflow-hidden rounded-sm bg-sunken"
            >
              <img
                :src="result.image"
                :alt="t(`landing.features.search.results.${result.index}.name`)"
                width="300"
                height="400"
                loading="lazy"
                class="h-full w-full object-contain"
              />
            </div>
            <span class="text-body-sm leading-tight font-semibold">
              {{ t(`landing.features.search.results.${result.index}.name`) }}
            </span>
            <span class="text-[11px] text-text-muted">
              {{ t(`landing.features.search.results.${result.index}.variant`) }}
            </span>
            <span class="text-tabular text-body-sm font-semibold text-indigo-600">{{
              result.price
            }}</span>
          </div>
        </div>
        <span
          class="bento-match mt-0.5 inline-flex items-center gap-1.5 self-center rounded-pill bg-ink-950 px-3.5 py-1.5 text-[12px] font-bold text-white"
        >
          {{ t('landing.features.search.compareReady') }}
        </span>
      </div>
    </div>
    <p class="mt-[18px] text-body-sm font-semibold text-indigo-600">
      {{ t('landing.features.search.exploreCatalogue') }} <span class="bento-arrow">→</span>
    </p>
  </BaseCard>
</template>
