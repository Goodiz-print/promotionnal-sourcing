<script setup lang="ts">
import BaseCard from '~/components/base/base_card.vue'
import FxCanvas from '~/components/marketing/fx_canvas.vue'
import { useMarketing } from '~/composables/use_marketing'

const { t } = useMarketing()
</script>

<template>
  <BaseCard
    data-reveal
    hover
    variant="dark"
    class="relative col-span-2 flex flex-col overflow-hidden p-6 md:col-span-6 md:flex-row md:items-center md:gap-8"
    style="transition-delay: 0.15s"
  >
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0"
      style="
        background: radial-gradient(
          420px 220px at 85% 20%,
          rgba(246, 166, 35, 0.14),
          transparent 65%
        );
      "
    />
    <div class="relative z-10 shrink-0">
      <p class="text-tabular text-[28px] font-semibold text-white">
        {{ t('landing.features.verified.count') }}
      </p>
      <p class="text-caption text-ink-300">{{ t('landing.features.verified.label') }}</p>
    </div>
    <div class="relative z-10 mt-3 min-h-[96px] flex-1 md:mt-0 md:h-[96px]">
      <FxCanvas kind="nodes" />
    </div>
    <div class="relative z-10 mt-3 flex shrink-0 items-baseline gap-2.5 md:mt-0">
      <span class="text-caption text-ink-300">{{
        t('landing.features.verified.noCommitment')
      }}</span>
      <span class="text-tabular text-heading-md text-white">✓</span>
    </div>
  </BaseCard>
</template>
