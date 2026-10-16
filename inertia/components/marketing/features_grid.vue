<script setup lang="ts">
import CompareCard from '~/components/marketing/features/compare_card.vue'
import ImageSearchCard from '~/components/marketing/features/image_search_card.vue'
import SearchCard from '~/components/marketing/features/search_card.vue'
import VerifiedCard from '~/components/marketing/features/verified_card.vue'
import { useMarketing } from '~/composables/use_marketing'

const { t } = useMarketing()
</script>

<template>
  <section id="agences" class="wrapper py-24">
    <div data-reveal class="mx-auto mb-16 max-w-[640px] text-center">
      <p class="mb-4 text-eyebrow text-text-brand">{{ t('landing.features.eyebrow') }}</p>
      <h2 class="mb-3 text-display-lg">{{ t('landing.features.heading') }}</h2>
      <p class="text-body-md text-text-secondary">{{ t('landing.features.intro') }}</p>
    </div>

    <div class="grid grid-cols-2 gap-4 md:grid-cols-6">
      <SearchCard />
      <ImageSearchCard />
      <CompareCard />
      <VerifiedCard />
    </div>

    <p class="mt-10 text-center">
      <a
        class="inline-flex items-center gap-2 text-body-md font-semibold text-indigo-600"
        href="#contact"
      >
        {{ t('landing.features.closingLink') }} <span aria-hidden="true">→</span>
      </a>
    </p>
  </section>
</template>
