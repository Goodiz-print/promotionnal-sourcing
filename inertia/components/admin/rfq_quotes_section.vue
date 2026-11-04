<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import TradeStatusBadge from '~/components/admin/trade_status_badge.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminRfqQuoteLine } from '#shared/types/admin_trade'

/** Devis reçus pour une demande, avec lien vers la fiche de supervision du devis. */
defineProps<{ quotes: AdminRfqQuoteLine[] }>()

const { t, locale } = useI18n()
const { money, dateTime } = useTradeFormat()
</script>

<template>
  <BaseSection :title="t('admin.rfqs.detail.quotes')" flush>
    <p v-if="quotes.length === 0" class="p-6 text-body-sm text-text-secondary">
      {{ t('admin.rfqs.detail.noQuotes') }}
    </p>
    <BaseTable v-else bare :caption="t('admin.rfqs.detail.quotes')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.trade.columns.supplier') }}</th>
          <th scope="col">{{ t('admin.trade.columns.status') }}</th>
          <th scope="col" class="text-right">{{ t('admin.trade.columns.amount') }}</th>
          <th scope="col">{{ t('admin.quotes.columns.submitted') }}</th>
          <th scope="col">
            <span class="sr-only">{{ t('admin.trade.view') }}</span>
          </th>
        </tr>
      </template>
      <tr v-for="quote in quotes" :key="quote.id">
        <td class="font-semibold text-text-primary">{{ quote.supplier.name }}</td>
        <td><TradeStatusBadge kind="quote" :status="quote.status" /></td>
        <td class="text-tabular text-right">{{ money(quote.totalAmount, quote.currency) }}</td>
        <td class="text-tabular whitespace-nowrap">{{ dateTime(quote.submittedAt) }}</td>
        <td class="text-right">
          <Link
            :href="urlFor('admin.quotes.show', { locale, id: quote.id })"
            class="text-body-sm font-semibold text-indigo-600 hover:underline"
          >
            {{ t('admin.quotes.number', { id: quote.id }) }}
          </Link>
        </td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
