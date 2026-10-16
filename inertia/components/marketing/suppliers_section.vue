<script setup lang="ts">
import BaseCard from '~/components/base_card.vue'
import BaseLinkButton from '~/components/base_link_button.vue'
import { useMarketing } from '~/composables/use_marketing'

const { t } = useMarketing()

const POINTS = [
  {
    key: 'point1',
    iconBg: 'bg-orange-500 text-white',
    path: 'M20 10.5 12.5 3H5a2 2 0 0 0-2 2v7.5l8.5 8.5a2 2 0 0 0 2.8 0L20 13.3a2 2 0 0 0 0-2.8Z',
    dot: true,
  },
  {
    key: 'point2',
    iconBg: 'bg-indigo-500 text-white',
    path: 'M12 15V4M12 4 8 8M12 4l4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  },
  {
    key: 'point3',
    iconBg: 'text-white',
    iconStyle: 'background: var(--gradient-brand)',
    path: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z',
    circle: true,
  },
  {
    key: 'point4',
    iconBg: 'bg-yellow-400 text-ink-950',
    path: 'M13 2 4 14h6l-1 8 9-12h-6l1-8Z',
  },
]
</script>

<template>
  <section id="fournisseurs" class="wrapper py-24">
    <div data-reveal class="mx-auto mb-12 max-w-[640px] text-center">
      <p class="mb-4 text-eyebrow text-text-brand">{{ t('landing.suppliers.kicker') }}</p>
      <h2 class="mb-3 text-display-lg">{{ t('landing.suppliers.heading') }}</h2>
      <p class="text-body-md text-text-secondary">{{ t('landing.suppliers.intro') }}</p>
    </div>

    <div class="mb-10 grid gap-5 md:grid-cols-2">
      <BaseCard
        v-for="(point, i) in POINTS"
        :key="point.key"
        data-reveal
        hover
        :style="`transition-delay: ${i * 0.06}s`"
        class="flex gap-4 p-6"
      >
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px]"
          :class="point.iconBg"
          :style="point.iconStyle"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path :d="point.path" />
            <circle v-if="point.dot" cx="8.5" cy="8.5" r="1.25" fill="currentColor" stroke="none" />
            <circle v-if="point.circle" cx="12" cy="12" r="3" />
          </svg>
        </span>
        <div>
          <p class="mb-1 text-heading-md">{{ t(`landing.suppliers.${point.key}Title`) }}</p>
          <p class="text-body-sm text-text-secondary">
            {{ t(`landing.suppliers.${point.key}Desc`) }}
          </p>
        </div>
      </BaseCard>
    </div>

    <div data-reveal class="text-center">
      <BaseLinkButton
        href="#contact"
        style="background: var(--gradient-brand); box-shadow: 0 8px 24px rgba(64, 50, 200, 0.35)"
      >
        {{ t('landing.suppliers.cta') }}<span aria-hidden="true">→</span>
      </BaseLinkButton>
    </div>
  </section>
</template>
