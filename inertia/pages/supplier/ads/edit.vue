<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import AdCampaignForm from '~/components/ads/ad_campaign_form.vue'
import AdStatusBadge from '~/components/ads/ad_status_badge.vue'
import BaseAlert from '~/components/base/base_alert.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import type { AdCampaignType } from '#shared/types/ads'

defineProps<{ campaign: AdCampaignType }>()

const { t, locale } = useI18n()
</script>

<template>
  <Head :title="t('ads.form.editTitle')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="campaign.productName"
      :eyebrow="t('ads.form.editTitle')"
      :back-href="urlFor('supplier.ads.index', { locale })"
      :back-label="t('ads.form.back')"
    >
      <template #meta><AdStatusBadge :status="campaign.status" /></template>
    </BasePageHeader>

    <BaseAlert v-if="campaign.status === 'suspended'" tone="danger">
      {{ t('ads.flash.suspended') }}
    </BaseAlert>

    <AdCampaignForm :campaign="campaign" />
  </div>
</template>
