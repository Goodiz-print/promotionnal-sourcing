<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import { formatDay, formatMoney, QUOTE_STATUS_TONES } from '~/components/quotes/types'
import type { QuoteType } from '#shared/types/quote'
import type { RfqItemType } from '#shared/types/rfq'

/**
 * Comparatif des devis remis : une colonne par fournisseur, une ligne par item
 * de la demande (prix unitaire et délai), puis total et délai global. Le moins
 * cher et le plus rapide parmi les devis encore en lice sont soulignés ; un
 * devis rejeté ou expiré reste lisible mais n'entre plus dans la comparaison.
 */
const props = defineProps<{ quotes: QuoteType[]; items: RfqItemType[] }>()

const { t, locale } = useI18n()

/** Devis encore en lice : remis ou accepté. */
const contenders = computed(() =>
  props.quotes.filter((quote) => quote.status === 'submitted' || quote.status === 'accepted')
)

const cheapestId = computed(
  () => [...contenders.value].sort((a, b) => a.totalAmount - b.totalAmount)[0]?.id
)
const fastestId = computed(
  () => [...contenders.value].sort((a, b) => a.leadTimeDays - b.leadTimeDays)[0]?.id
)

function lineFor(quote: QuoteType, rfqItemId: number) {
  return quote.items.find((item) => item.rfqItemId === rfqItemId)
}
</script>

<template>
  <p v-if="quotes.length === 0" class="text-sm text-[var(--gray-6)]">
    {{ t('quote.comparison.empty') }}
  </p>

  <div v-else class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-[var(--gray-3)] align-top">
        <tr>
          <th class="py-2 pr-4 font-medium text-[var(--gray-6)]">{{ t('quote.table.item') }}</th>
          <th v-for="quote in quotes" :key="quote.id" class="min-w-[160px] py-2 pr-4">
            <Link
              route="quotes.show"
              :params="{ locale, id: quote.id }"
              class="font-medium text-[var(--color-primary)] hover:underline"
            >
              {{ quote.supplierName }}
            </Link>
            <div class="mt-1">
              <BaseBadge :tone="QUOTE_STATUS_TONES[quote.status]">
                {{ t(`quote.status.${quote.status}`) }}
              </BaseBadge>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id" class="border-b border-[var(--gray-2)]">
          <td class="py-2 pr-4">{{ item.name }}</td>
          <td v-for="quote in quotes" :key="quote.id" class="py-2 pr-4 whitespace-nowrap">
            <template v-if="lineFor(quote, item.id)">
              {{ formatMoney(lineFor(quote, item.id)!.unitPrice, quote.currency, locale) }}
              <span class="text-[var(--gray-6)]">
                · {{ t('quote.table.days', { count: lineFor(quote, item.id)!.leadTimeDays }) }}
              </span>
            </template>
            <span v-else class="text-[var(--gray-5)]">{{ t('quote.comparison.notQuoted') }}</span>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td class="py-2 pr-4 font-medium">{{ t('quote.table.total') }}</td>
          <td v-for="quote in quotes" :key="quote.id" class="py-2 pr-4 whitespace-nowrap">
            <span class="font-medium">
              {{ formatMoney(quote.totalAmount, quote.currency, locale) }}
            </span>
            <BaseBadge v-if="quote.id === cheapestId && contenders.length > 1" tone="success">
              {{ t('quote.comparison.cheapest') }}
            </BaseBadge>
          </td>
        </tr>
        <tr>
          <td class="py-2 pr-4 font-medium">{{ t('quote.comparison.leadTime') }}</td>
          <td v-for="quote in quotes" :key="quote.id" class="py-2 pr-4 whitespace-nowrap">
            {{ t('quote.table.days', { count: quote.leadTimeDays }) }}
            <BaseBadge v-if="quote.id === fastestId && contenders.length > 1" tone="info">
              {{ t('quote.comparison.fastest') }}
            </BaseBadge>
          </td>
        </tr>
        <tr>
          <td class="py-2 pr-4 font-medium">{{ t('quote.comparison.validUntil') }}</td>
          <td v-for="quote in quotes" :key="quote.id" class="py-2 pr-4">
            {{ quote.validUntil ? formatDay(quote.validUntil, locale) : '—' }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
