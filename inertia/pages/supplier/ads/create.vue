<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Package } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import AdCampaignForm from '~/components/ads/ad_campaign_form.vue'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import type { AdProductOptionType } from '#shared/types/ads'

defineProps<{ products: AdProductOptionType[] }>()

const { t, locale } = useI18n()
</script>

<template>
  <Head :title="t('ads.form.createTitle')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('ads.form.createTitle')"
      :description="t('ads.form.createSubtitle')"
      :back-href="urlFor('supplier.ads.index', { locale })"
      :back-label="t('ads.form.back')"
    />

    <BaseEmptyState
      v-if="products.length === 0"
      :title="t('ads.form.noProducts')"
      :description="t('ads.form.noProductsDescription')"
      :icon="Package"
    />
    <template v-else>
      <BaseAlert tone="info" :title="t('ads.form.howItWorksTitle')">
        {{ t('ads.form.howItWorks') }}
      </BaseAlert>
      <AdCampaignForm :products="products" />
    </template>
  </div>
</template>
