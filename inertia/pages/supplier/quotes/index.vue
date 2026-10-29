<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { FileText } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseTable from '~/components/base/base_table.vue'
import { formatDay, formatMoney, QUOTE_STATUS_TONES } from '~/components/quotes/types'
import type { QuoteType } from '#shared/types/quote'

defineProps<{ quotes: QuoteType[] }>()

const { t, locale } = useI18n()

const rfqsUrl = computed(() => urlFor('supplier.rfqs.index', { locale: locale.value }))
</script>

<template>
  <Head :title="t('quote.supplier.index.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('quote.supplier.index.title')"
      :description="t('quote.supplier.index.subtitle')"
    />

    <BaseEmptyState
      v-if="quotes.length === 0"
      :title="t('quote.supplier.index.empty')"
      :description="t('quote.supplier.index.emptyDescription')"
      :icon="FileText"
    >
      <template #actions>
        <BaseLinkButton :href="rfqsUrl" variant="secondary">
          {{ t('quote.supplier.index.browseRfqs') }}
        </BaseLinkButton>
      </template>
    </BaseEmptyState>

    <BaseTable v-else :caption="t('quote.supplier.index.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('quote.supplier.index.columns.rfq') }}</th>
          <th scope="col" class="text-right">{{ t('quote.supplier.index.columns.total') }}</th>
          <th scope="col" class="text-right">{{ t('quote.supplier.index.columns.leadTime') }}</th>
          <th scope="col">{{ t('quote.supplier.index.columns.validUntil') }}</th>
          <th scope="col">{{ t('quote.supplier.index.columns.status') }}</th>
        </tr>
      </template>

      <tr v-for="quote in quotes" :key="quote.id">
        <td>
          <Link
            route="supplier.quotes.show"
            :params="{ locale, id: quote.id }"
            class="font-semibold text-text-primary hover:text-indigo-600"
          >
            {{ quote.rfqTitle }}
          </Link>
        </td>
        <td class="text-tabular text-right whitespace-nowrap">
          {{ formatMoney(quote.totalAmount, quote.currency, locale) }}
        </td>
        <td class="text-tabular text-right whitespace-nowrap">
          {{ t('quote.table.days', { count: quote.leadTimeDays }) }}
        </td>
        <td class="text-tabular whitespace-nowrap">
          <template v-if="quote.validUntil">{{ formatDay(quote.validUntil, locale) }}</template>
          <span v-else class="text-text-muted">{{ t('quote.comparison.noValidity') }}</span>
        </td>
        <td>
          <BaseBadge dot :tone="QUOTE_STATUS_TONES[quote.status]">
            {{ t(`quote.status.${quote.status}`) }}
          </BaseBadge>
        </td>
      </tr>
    </BaseTable>
  </div>
</template>
