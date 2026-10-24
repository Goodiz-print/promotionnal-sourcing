<script setup lang="ts">
import DiscoverSection from '~/components/marketing/discover_section.vue'
import FeaturesGrid from '~/components/marketing/features_grid.vue'
import FinalCta from '~/components/marketing/final_cta.vue'
import Hero from '~/components/marketing/hero.vue'
import MarketingHead from '~/components/marketing/marketing_head.vue'
import StatsBand from '~/components/marketing/stats_band.vue'
import SuppliersSection from '~/components/marketing/suppliers_section.vue'
import { useMarketing } from '~/composables/use_marketing'
import MarketingLayout from '~/layouts/marketing.vue'
import type { CategoryType } from '#shared/types/category'

defineOptions({ layout: MarketingLayout })
defineProps<{ siteUrl: string; featuredCategories: CategoryType[] }>()

const { t } = useMarketing()
</script>

<template>
  <MarketingHead
    :title="t('landing.seo.title')"
    :description="t('landing.seo.description')"
    :site-url="siteUrl"
  />
  <Hero />
  <DiscoverSection :categories="featuredCategories" />
  <FeaturesGrid />
  <StatsBand />
  <SuppliersSection />
  <FinalCta />
</template>
