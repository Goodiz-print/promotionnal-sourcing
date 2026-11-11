<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Megaphone } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useAdFormat } from '~/composables/use_ad_format'
import AdCampaignProduct from '~/components/ads/ad_campaign_product.vue'
import AdStatusBadge from '~/components/ads/ad_status_badge.vue'
import AdWalletAdjustForm from '~/components/admin/ad_wallet_adjust_form.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminAdCampaignType, AdminAdCampaignsType } from '#shared/types/ads'

defineProps<{ campaigns: AdminAdCampaignsType }>()

const { t, locale } = useI18n()
const { money } = useAdFormat()

function goToPage(page: number) {
  router.get(urlFor('admin.ads.index', { locale: locale.value }), { page }, { only: ['campaigns'] })
}

function setSuspended(campaign: AdminAdCampaignType, suspended: boolean) {
  const route = suspended ? 'admin.ads.suspend' : 'admin.ads.restore'
  router.post(
    urlFor(route, { locale: locale.value, id: campaign.id }),
    {},
    { preserveScroll: true }
  )
}
</script>

<template>
  <Head :title="t('admin.ads.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('admin.ads.title')" :description="t('admin.ads.subtitle')" />

    <AdWalletAdjustForm />

    <div class="flex flex-col gap-4">
      <p class="text-tabular text-body-sm text-text-secondary">
        {{ t('admin.ads.resultsCount', { count: campaigns.meta.total }) }}
      </p>

      <BaseEmptyState
        v-if="campaigns.meta.total === 0"
        :title="t('admin.ads.empty')"
        :description="t('admin.ads.emptyDescription')"
        :icon="Megaphone"
      />
      <BaseTable v-else :caption="t('admin.ads.title')">
        <template #head>
          <tr>
            <th scope="col">{{ t('ads.index.columns.product') }}</th>
            <th scope="col">{{ t('admin.ads.columns.organization') }}</th>
            <th scope="col">{{ t('ads.index.columns.status') }}</th>
            <th scope="col" class="text-right">{{ t('ads.index.columns.bid') }}</th>
            <th scope="col" class="text-right">{{ t('ads.index.columns.clicks') }}</th>
            <th scope="col" class="text-right">{{ t('ads.index.columns.spent') }}</th>
            <th scope="col" class="text-right">{{ t('admin.ads.columns.wallet') }}</th>
            <th scope="col" class="text-right">
              <span class="sr-only">{{ t('ads.index.columns.actions') }}</span>
            </th>
          </tr>
        </template>

        <tr v-for="campaign in campaigns.data" :key="campaign.id">
          <td><AdCampaignProduct :campaign="campaign" /></td>
          <td>
            <Link
              route="admin.organizations.show"
              :params="{ locale, id: campaign.organizationId }"
              class="font-semibold text-text-primary hover:text-indigo-600"
            >
              {{ campaign.organizationName }}
            </Link>
            <span class="block text-caption text-text-muted">#{{ campaign.organizationId }}</span>
          </td>
          <td><AdStatusBadge :status="campaign.status" /></td>
          <td class="text-tabular text-right whitespace-nowrap">
            {{ money(campaign.maxCpcCents) }}
          </td>
          <td class="text-tabular text-right">
            {{ campaign.stats.billedClicks }} / {{ campaign.stats.clicks }}
          </td>
          <td class="text-tabular text-right whitespace-nowrap">
            {{ money(campaign.stats.spentCents) }}
          </td>
          <td class="text-tabular text-right whitespace-nowrap">
            {{ money(campaign.walletBalanceCents) }}
          </td>
          <td class="text-right">
            <BaseButton
              v-if="campaign.status === 'suspended'"
              size="sm"
              variant="secondary"
              @click="setSuspended(campaign, false)"
            >
              {{ t('admin.ads.actions.restore') }}
            </BaseButton>
            <BaseButton v-else size="sm" variant="secondary" @click="setSuspended(campaign, true)">
              {{ t('admin.ads.actions.suspend') }}
            </BaseButton>
          </td>
        </tr>
      </BaseTable>

      <BasePagination
        :meta="campaigns.meta"
        :previous-label="t('admin.pagination.previous')"
        :next-label="t('admin.pagination.next')"
        @change="goToPage"
      />
    </div>
  </div>
</template>
