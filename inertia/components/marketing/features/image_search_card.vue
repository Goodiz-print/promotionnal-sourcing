<script setup lang="ts">
import BaseCard from '~/components/base_card.vue'
import FxCanvas from '~/components/marketing/fx_canvas.vue'
import { useMarketing } from '~/composables/use_marketing'

const { t } = useMarketing()

/* Fichiers de `public/` : liés par une chaîne dynamique pour que Vite ne tente pas de les résoudre comme import. */
const UPLOADED_IMAGE_SRC = '/img/mock-tote-bag.jpg'
</script>

<template>
  <BaseCard
    data-reveal
    hover
    variant="brand"
    class="group col-span-2 flex flex-col p-7 md:col-span-3"
    style="transition-delay: 0.05s; background: var(--gradient-brand)"
  >
    <p class="mb-2 text-heading-lg text-white">{{ t('landing.features.imageSearch.title') }}</p>
    <p class="mb-5 text-body-md text-indigo-100">
      {{ t('landing.features.imageSearch.description') }}
    </p>
    <div
      class="relative flex min-h-[190px] flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-md border border-dashed border-white/40 bg-white/[0.07]"
    >
      <FxCanvas kind="scan" />
      <div
        class="anim-scan-line absolute right-[6%] left-[6%] h-0.5"
        style="
          background: linear-gradient(90deg, transparent, #fff, transparent);
          box-shadow: 0 0 14px rgba(255, 255, 255, 0.9);
        "
      />
      <div
        class="relative h-[176px] w-[176px] overflow-hidden rounded-md border border-white/25 bg-white/[0.14]"
      >
        <img
          :src="UPLOADED_IMAGE_SRC"
          :alt="t('landing.features.imageSearch.uploadedAlt')"
          width="176"
          height="176"
          loading="lazy"
          class="h-full w-full object-cover"
        />
      </div>
      <p class="relative text-body-sm font-medium text-indigo-100">
        {{ t('landing.features.imageSearch.dropHint') }}
      </p>
      <div
        class="bento-match relative inline-flex items-center gap-2 rounded-pill bg-white px-3.5 py-1.5 text-[12px] font-bold text-indigo-600"
      >
        <span class="text-tabular">{{ t('landing.features.imageSearch.matchResult') }}</span>
      </div>
    </div>
    <p class="mt-[18px] text-body-sm font-semibold text-white">
      {{ t('landing.features.imageSearch.tryButton') }} <span class="bento-arrow">→</span>
    </p>
  </BaseCard>
</template>
