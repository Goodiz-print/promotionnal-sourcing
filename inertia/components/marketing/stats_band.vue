<script setup lang="ts">
import { computed } from 'vue'
import FxCanvas from '~/components/marketing/fx_canvas.vue'
import { useMarketing } from '~/composables/use_marketing'

const { t } = useMarketing()

const stats = computed(() => [
  { to: '1128349', suffix: '', label: t('landing.stats.stat1') },
  { to: '300', suffix: '+', label: t('landing.stats.stat2') },
  { to: '24', suffix: ' h', label: t('landing.stats.stat3') },
])
</script>

<template>
  <section class="relative overflow-hidden bg-ink-950">
    <div
      aria-hidden="true"
      class="anim-daynight absolute inset-0 z-0"
      style="
        background-image: linear-gradient(
          118deg,
          #140d38 0%,
          #2a1c6b 22%,
          #4032c8 42%,
          #6b4de6 58%,
          #35236e 76%,
          #140d38 100%
        );
      "
    />
    <div
      aria-hidden="true"
      class="absolute inset-0 z-0"
      style="
        background:
          radial-gradient(120% 80% at 78% 30%, rgba(120, 90, 240, 0.32), transparent 60%),
          radial-gradient(70% 50% at 88% 78%, rgba(246, 166, 35, 0.16), transparent 60%);
      "
    />
    <div
      data-reveal
      class="wrapper relative z-10 grid gap-10 py-[72px] md:grid-cols-2 md:items-center"
    >
      <div>
        <h2 class="mb-10 max-w-[420px] text-display-lg text-white">
          {{ t('landing.stats.heading') }}
        </h2>
        <div class="grid max-w-[460px] grid-cols-2 gap-x-10 gap-y-8">
          <div v-for="stat in stats" :key="stat.to">
            <div
              :data-count-to="stat.to"
              :data-count-suffix="stat.suffix"
              class="text-tabular text-stat-figure mb-1.5 text-white"
            >
              0
            </div>
            <p class="text-body-sm leading-snug text-indigo-100">{{ stat.label }}</p>
          </div>
          <div>
            <div class="text-tabular text-stat-figure mb-1.5 text-white">
              {{ t('landing.stats.stat4') }}
            </div>
          </div>
        </div>
      </div>
      <div class="relative mx-auto aspect-square w-full max-w-[480px]">
        <FxCanvas kind="globe" />
      </div>
    </div>
  </section>
</template>
