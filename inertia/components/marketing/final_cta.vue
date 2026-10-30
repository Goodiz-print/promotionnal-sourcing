<script setup lang="ts">
import BaseLinkButton from '~/components/base/base_link_button.vue'
import { useMarketing } from '~/composables/use_marketing'

const { t, path } = useMarketing()
</script>

<template>
  <section
    id="contact"
    class="relative overflow-hidden px-6 py-[88px] text-center md:px-10"
    style="background: var(--gradient-brand)"
  >
    <div
      aria-hidden="true"
      class="pointer-events-none absolute bottom-[-190px] left-[-140px] z-0 h-[420px] w-[420px] rounded-full opacity-[0.14] blur-[2px]"
      style="background: #ffffff; transform: rotate(-14deg)"
    />
    <div data-reveal class="relative z-10">
      <span
        class="mb-6 inline-block rounded-pill border border-white/35 bg-white/[0.16] px-5 py-2 text-eyebrow text-white"
      >
        {{ t('landing.finalCta.badge') }}
      </span>
      <h2 class="mx-auto mb-4 max-w-[640px] text-display-lg text-white">
        {{ t('landing.finalCta.heading') }}
      </h2>
      <p class="mx-auto mb-9 max-w-[560px] text-body-lg text-indigo-100">
        {{ t('landing.finalCta.descriptionBefore')
        }}<b class="text-yellow-300">{{ t('landing.finalCta.descriptionHighlight') }}</b
        >{{ t('landing.finalCta.descriptionAfter') }}
      </p>
      <BaseLinkButton size="lg" variant="on-dark" :href="`${path('contact')}?type=partnership`">
        {{ t('landing.finalCta.cta') }}
      </BaseLinkButton>
    </div>
  </section>
</template>
