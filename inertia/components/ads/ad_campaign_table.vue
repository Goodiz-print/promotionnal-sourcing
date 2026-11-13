<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Pause, Play, Trash2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useAdFormat } from '~/composables/use_ad_format'
import AdCampaignProduct from '~/components/ads/ad_campaign_product.vue'
import AdStatusBadge from '~/components/ads/ad_status_badge.vue'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdCampaignType } from '#shared/types/ads'

/** Campagnes du fournisseur : réglages, statistiques, pause / reprise / suppression. */
defineProps<{ campaigns: AdCampaignType[] }>()

const { t, locale } = useI18n()
const { money, day } = useAdFormat()

function editUrl(campaign: AdCampaignType): string {
  return urlFor('supplier.ads.edit', { locale: locale.value, id: campaign.id })
}

function setStatus(campaign: AdCampaignType, status: 'active' | 'paused') {
  router.patch(
    urlFor('supplier.ads.status', { locale: locale.value, id: campaign.id }),
    { status },
    { preserveScroll: true }
  )
}

function destroy(campaign: AdCampaignType) {
  if (!window.confirm(t('ads.actions.confirmDelete'))) return
  router.delete(urlFor('supplier.ads.destroy', { locale: locale.value, id: campaign.id }), {
    preserveScroll: true,
  })
}
</script>

<template>
  <BaseTable :caption="t('ads.index.campaigns')">
    <template #head>
      <tr>
        <th scope="col">{{ t('ads.index.columns.product') }}</th>
        <th scope="col">{{ t('ads.index.columns.status') }}</th>
        <th scope="col" class="text-right">{{ t('ads.index.columns.bid') }}</th>
        <th scope="col" class="text-right">{{ t('ads.index.columns.budget') }}</th>
        <th scope="col" class="text-right">{{ t('ads.index.columns.impressions') }}</th>
        <th scope="col" class="text-right">{{ t('ads.index.columns.clicks') }}</th>
        <th scope="col" class="text-right">{{ t('ads.index.columns.spent') }}</th>
        <th scope="col" class="text-right">
          <span class="sr-only">{{ t('ads.index.columns.actions') }}</span>
        </th>
      </tr>
    </template>

    <tr v-for="campaign in campaigns" :key="campaign.id">
      <td>
        <AdCampaignProduct :campaign="campaign">
          <Link
            route="supplier.ads.edit"
            :params="{ locale, id: campaign.id }"
            class="truncate font-semibold text-text-primary hover:text-indigo-600"
          >
            {{ campaign.productName }}
          </Link>
          <template #meta>
            <span class="text-caption text-text-muted">
              {{
                campaign.endsOn
                  ? t('ads.index.period', {
                      from: day(campaign.startsOn),
                      to: day(campaign.endsOn),
                    })
                  : t('ads.index.periodOpen', { from: day(campaign.startsOn) })
              }}
            </span>
          </template>
        </AdCampaignProduct>
      </td>
      <td><AdStatusBadge :status="campaign.status" /></td>
      <td class="text-tabular text-right whitespace-nowrap">{{ money(campaign.maxCpcCents) }}</td>
      <td class="text-tabular text-right whitespace-nowrap">
        {{ money(campaign.dailyBudgetCents) }}
      </td>
      <td class="text-tabular text-right">{{ campaign.stats.impressions }}</td>
      <td class="text-tabular text-right">{{ campaign.stats.clicks }}</td>
      <td class="text-tabular text-right whitespace-nowrap">
        {{ money(campaign.stats.spentCents) }}
      </td>
      <td>
        <div class="flex items-center justify-end gap-2">
          <BaseIconButton
            v-if="campaign.status === 'active'"
            :label="t('ads.actions.pause')"
            @click="setStatus(campaign, 'paused')"
          >
            <Pause :size="18" aria-hidden="true" />
          </BaseIconButton>
          <BaseIconButton
            v-else-if="campaign.status === 'paused'"
            :label="t('ads.actions.resume')"
            @click="setStatus(campaign, 'active')"
          >
            <Play :size="18" aria-hidden="true" />
          </BaseIconButton>
          <BaseLinkButton :href="editUrl(campaign)" size="sm" variant="secondary">
            {{ t('ads.actions.edit') }}
          </BaseLinkButton>
          <BaseIconButton :label="t('ads.actions.delete')" @click="destroy(campaign)">
            <Trash2 :size="18" aria-hidden="true" />
          </BaseIconButton>
        </div>
      </td>
    </tr>
  </BaseTable>
</template>
