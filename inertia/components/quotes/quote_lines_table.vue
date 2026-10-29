<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseTable from '~/components/base/base_table.vue'
import { formatMoney } from '~/components/quotes/types'
import type { QuoteType } from '#shared/types/quote'

/**
 * Lignes d'un devis remis, en lecture seule — écran du devis côté acheteur et
 * côté fournisseur une fois le devis figé. `bare` retire le cadre quand le
 * tableau est déjà posé dans une `BaseSection flush`.
 */
withDefaults(defineProps<{ quote: QuoteType; bare?: boolean }>(), { bare: false })

const { t, locale } = useI18n()
</script>

<template>
  <BaseTable :bare="bare">
    <template #head>
      <tr>
        <th scope="col">{{ t('quote.table.item') }}</th>
        <th scope="col" class="text-right">{{ t('quote.table.unitPrice') }}</th>
        <th scope="col" class="text-right">{{ t('quote.table.quantity') }}</th>
        <th scope="col" class="text-right">{{ t('quote.table.leadTime') }}</th>
        <th scope="col" class="text-right">{{ t('quote.table.total') }}</th>
      </tr>
    </template>

    <tr v-for="item in quote.items" :key="item.id">
      <td>
        <p class="font-medium">{{ item.rfqItemName }}</p>
        <p v-if="item.customizationDetails?.note" class="text-caption text-text-muted">
          {{ item.customizationDetails.note }}
        </p>
      </td>
      <td class="text-tabular text-right whitespace-nowrap">
        {{ formatMoney(item.unitPrice, quote.currency, locale) }}
      </td>
      <td class="text-tabular text-right">{{ item.quantity }}</td>
      <td class="text-tabular text-right whitespace-nowrap">
        {{ t('quote.table.days', { count: item.leadTimeDays }) }}
      </td>
      <td class="text-tabular text-right whitespace-nowrap">
        {{ formatMoney(item.totalPrice, quote.currency, locale) }}
      </td>
    </tr>

    <template #foot>
      <tr>
        <td colspan="4" class="text-right">{{ t('quote.table.total') }}</td>
        <td class="text-tabular text-right whitespace-nowrap">
          {{ formatMoney(quote.totalAmount, quote.currency, locale) }}
        </td>
      </tr>
    </template>
  </BaseTable>
</template>
