<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { Megaphone, Plus } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import AdCampaignTable from '~/components/ads/ad_campaign_table.vue'
import AdWalletCard from '~/components/ads/ad_wallet_card.vue'
import AdWalletHistory from '~/components/ads/ad_wallet_history.vue'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import type { AdCampaignType, AdWalletType } from '#shared/types/ads'

defineProps<{
  wallet: AdWalletType
  campaigns: AdCampaignType[]
  // Retour de la page de paiement : `success` ou `cancelled`.
  topUpStatus: 'success' | 'cancelled' | null
}>()

const { t, locale } = useI18n()

const createUrl = computed(() => urlFor('supplier.ads.create', { locale: locale.value }))
</script>

<template>
  <Head :title="t('ads.index.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('ads.index.title')" :description="t('ads.index.subtitle')">
      <template v-if="campaigns.length > 0" #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('ads.index.newCampaign') }}
        </BaseLinkButton>
      </template>
    </BasePageHeader>

    <BaseAlert v-if="topUpStatus === 'success'" tone="success">
      {{ t('ads.wallet.topUpSuccess') }}
    </BaseAlert>
    <BaseAlert v-else-if="topUpStatus === 'cancelled'" tone="warning">
      {{ t('ads.wallet.topUpCancelled') }}
    </BaseAlert>

    <AdWalletCard :wallet="wallet" />

    <BaseEmptyState
      v-if="campaigns.length === 0"
      :title="t('ads.index.empty')"
      :description="t('ads.index.emptyDescription')"
      :icon="Megaphone"
    >
      <template #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('ads.index.newCampaign') }}
        </BaseLinkButton>
      </template>
    </BaseEmptyState>
    <AdCampaignTable v-else :campaigns="campaigns" />

    <AdWalletHistory v-if="wallet.transactions.length > 0" :transactions="wallet.transactions" />
  </div>
</template>
