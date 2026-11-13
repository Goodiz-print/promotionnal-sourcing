<script setup lang="ts">
import SponsoredProducts from '~/components/ads/sponsored_products.vue'
import { useMarketing } from '~/composables/use_marketing'
import type { SponsoredProductType } from '#shared/types/ads'

/** Bandeau de produits sponsorisés de l'accueil ; absent s'il n'y en a aucun. */
defineProps<{ items: SponsoredProductType[] }>()

const { t } = useMarketing()
</script>

<template>
  <section v-if="items.length > 0" class="wrapper py-16" data-testid="sponsored-section">
    <div class="mx-auto mb-10 max-w-[640px] text-center">
      <p class="mb-4 text-eyebrow text-text-brand">{{ t('ads.sponsored.badge') }}</p>
      <h2 class="mb-3 text-display-lg">{{ t('ads.sponsored.homeTitle') }}</h2>
      <p class="text-body-md text-text-secondary">{{ t('ads.sponsored.homeSubtitle') }}</p>
    </div>
    <SponsoredProducts :items="items" :columns="4" />
  </section>
</template>
