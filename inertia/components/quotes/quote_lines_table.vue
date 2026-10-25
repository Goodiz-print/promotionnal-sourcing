<script setup lang="ts">
import { useI18n } from '~/i18n'
import { formatMoney } from '~/components/quotes/types'
import type { QuoteType } from '#shared/types/quote'

/**
 * Lignes d'un devis remis, en lecture seule — écran du devis côté acheteur et
 * côté fournisseur une fois le devis figé.
 */
defineProps<{ quote: QuoteType }>()

const { t, locale } = useI18n()
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-[var(--gray-3)] text-[var(--gray-6)]">
        <tr>
          <th class="py-2 pr-4 font-medium">{{ t('quote.table.item') }}</th>
          <th class="py-2 pr-4 text-right font-medium">{{ t('quote.table.unitPrice') }}</th>
          <th class="py-2 pr-4 text-right font-medium">{{ t('quote.table.quantity') }}</th>
          <th class="py-2 pr-4 text-right font-medium">{{ t('quote.table.leadTime') }}</th>
          <th class="py-2 text-right font-medium">{{ t('quote.table.total') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in quote.items" :key="item.id" class="border-b border-[var(--gray-2)]">
          <td class="py-2 pr-4">
            <p>{{ item.rfqItemName }}</p>
            <p v-if="item.customizationDetails?.note" class="text-[var(--gray-6)]">
              {{ item.customizationDetails.note }}
            </p>
          </td>
          <td class="py-2 pr-4 text-right whitespace-nowrap">
            {{ formatMoney(item.unitPrice, quote.currency, locale) }}
          </td>
          <td class="py-2 pr-4 text-right">{{ item.quantity }}</td>
          <td class="py-2 pr-4 text-right whitespace-nowrap">
            {{ t('quote.table.days', { count: item.leadTimeDays }) }}
          </td>
          <td class="py-2 text-right whitespace-nowrap">
            {{ formatMoney(item.totalPrice, quote.currency, locale) }}
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" class="py-2 pr-4 text-right font-medium">{{ t('quote.table.total') }}</td>
          <td class="py-2 text-right font-medium whitespace-nowrap">
            {{ formatMoney(quote.totalAmount, quote.currency, locale) }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
