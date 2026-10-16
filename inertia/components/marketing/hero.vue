<script setup lang="ts">
import BaseLinkButton from '~/components/base_link_button.vue'
import ProductMockup from '~/components/marketing/product_mockup.vue'
import { useMarketing } from '~/composables/use_marketing'

const { t } = useMarketing()
</script>

<template>
  <section class="relative overflow-hidden bg-white px-6 pb-16 pt-16 md:px-10 md:pb-24 md:pt-20">
    <div
      aria-hidden="true"
      class="anim-blob pointer-events-none absolute top-[-24%] right-[-16%] bottom-[10%] left-[52%] z-0 hidden md:block"
      style="
        background-image:
          radial-gradient(45% 45% at 50% 30%, rgba(255, 255, 255, 0.4), transparent 70%),
          linear-gradient(
            135deg,
            var(--indigo-500) 0%,
            #7a3fd4 32%,
            #c957c2 62%,
            var(--orange-500) 100%
          );
        background-size: 100% 100%;
        opacity: 0.96;
      "
    />

    <div
      class="relative z-10 mx-auto grid max-w-[1140px] items-center gap-12 text-left md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:gap-10"
    >
      <div class="min-w-0 text-center md:text-left">
        <div
          class="anim-rise mb-7 inline-flex items-center gap-2 rounded-pill border border-indigo-100 bg-brand-subtle px-4 py-1.5 text-eyebrow text-indigo-600"
        >
          <span
            class="anim-pulse-dot inline-block h-2 w-2 rounded-full bg-orange-500"
            aria-hidden="true"
          />
          {{ t('landing.hero.eyebrow') }}
        </div>
        <h1
          class="anim-rise mb-6 text-display-lg sm:text-display-xl"
          style="animation-delay: 0.06s"
        >
          {{ t('landing.hero.titleLine1') }}<br />
          <span class="text-indigo-600">{{ t('landing.hero.titleWord1') }}</span>
          {{ ' ' }}<span class="text-amber-600">{{ t('landing.hero.titleWord2') }}</span> {{ ' '
          }}<span class="text-gradient-brand">{{ t('landing.hero.titleWord3') }}</span>
        </h1>
        <p
          class="anim-rise mb-3.5 max-w-[540px] text-body-lg text-text-secondary"
          style="animation-delay: 0.12s"
        >
          {{ t('landing.hero.lead') }}
        </p>
        <p class="anim-rise mb-9 font-semibold text-text-primary" style="animation-delay: 0.15s">
          {{ t('landing.hero.sub') }}
        </p>

        <div
          class="anim-rise flex flex-wrap items-center justify-center gap-4 md:justify-start"
          style="animation-delay: 0.18s"
        >
          <BaseLinkButton
            href="#agences"
            class="hover:-translate-y-0.5"
            style="
              background: var(--gradient-brand);
              box-shadow: 0 8px 24px rgba(64, 50, 200, 0.35);
            "
          >
            {{ t('landing.hero.ctaPrimary') }}<span aria-hidden="true">→</span>
          </BaseLinkButton>
          <BaseLinkButton
            href="#contact"
            variant="secondary"
            style="border: 2px solid var(--indigo-500); color: var(--indigo-500); background: #fff"
          >
            {{ t('landing.hero.ctaSecondary') }}
          </BaseLinkButton>
        </div>
      </div>

      <div class="relative min-w-0 md:rotate-[1.5deg]">
        <ProductMockup />
      </div>
    </div>
  </section>
</template>
