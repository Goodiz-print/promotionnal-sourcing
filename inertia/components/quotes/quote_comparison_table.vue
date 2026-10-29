<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@adonisjs/inertia/vue'
import { FileText } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseTable from '~/components/base/base_table.vue'
import { formatDay, formatMoney, QUOTE_STATUS_TONES } from '~/components/quotes/types'
import type { QuoteType } from '#shared/types/quote'
import type { RfqItemType } from '#shared/types/rfq'

/**
 * Comparatif des devis remis : une colonne par fournisseur, une ligne par item
 * de la demande (prix unitaire et délai), puis total et délai global. Le moins
 * cher et le plus rapide parmi les devis encore en lice sont soulignés ; un
 * devis rejeté ou expiré reste lisible mais n'entre plus dans la comparaison.
 * Conçu pour une `BaseSection flush`.
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
  <div v-if="quotes.length === 0" class="p-6">
    <BaseEmptyState compact :title="t('quote.comparison.empty')" :icon="FileText" />
  </div>

  <BaseTable v-else bare :caption="t('quote.comparison.title')">
    <template #head>
      <tr>
        <th scope="col">{{ t('quote.table.item') }}</th>
        <th v-for="quote in quotes" :key="quote.id" scope="col" class="min-w-[160px] align-top">
          <Link
            route="quotes.show"
            :params="{ locale, id: quote.id }"
            class="font-semibold text-text-primary hover:text-indigo-600"
          >
            {{ quote.supplierName }}
          </Link>
          <div class="mt-1">
            <BaseBadge dot :tone="QUOTE_STATUS_TONES[quote.status]">
              {{ t(`quote.status.${quote.status}`) }}
            </BaseBadge>
          </div>
        </th>
      </tr>
    </template>

    <tr v-for="item in items" :key="item.id">
      <td class="font-medium">{{ item.name }}</td>
      <td v-for="quote in quotes" :key="quote.id" class="text-tabular text-right whitespace-nowrap">
        <template v-if="lineFor(quote, item.id)">
          {{ formatMoney(lineFor(quote, item.id)!.unitPrice, quote.currency, locale) }}
          <span class="text-text-muted">
            · {{ t('quote.table.days', { count: lineFor(quote, item.id)!.leadTimeDays }) }}
          </span>
        </template>
        <span v-else class="text-text-muted">{{ t('quote.comparison.notQuoted') }}</span>
      </td>
    </tr>

    <template #foot>
      <tr>
        <td>{{ t('quote.table.total') }}</td>
        <td
          v-for="quote in quotes"
          :key="quote.id"
          class="text-tabular text-right whitespace-nowrap"
        >
          <span class="inline-flex items-center justify-end gap-2">
            {{ formatMoney(quote.totalAmount, quote.currency, locale) }}
            <BaseBadge v-if="quote.id === cheapestId && contenders.length > 1" tone="success">
              {{ t('quote.comparison.cheapest') }}
            </BaseBadge>
          </span>
        </td>
      </tr>
      <tr>
        <td>{{ t('quote.comparison.leadTime') }}</td>
        <td
          v-for="quote in quotes"
          :key="quote.id"
          class="text-tabular text-right whitespace-nowrap"
        >
          <span class="inline-flex items-center justify-end gap-2">
            {{ t('quote.table.days', { count: quote.leadTimeDays }) }}
            <BaseBadge v-if="quote.id === fastestId && contenders.length > 1" tone="info">
              {{ t('quote.comparison.fastest') }}
            </BaseBadge>
          </span>
        </td>
      </tr>
      <tr>
        <td>{{ t('quote.comparison.validUntil') }}</td>
        <td v-for="quote in quotes" :key="quote.id" class="text-tabular text-right">
          <template v-if="quote.validUntil">{{ formatDay(quote.validUntil, locale) }}</template>
          <span v-else class="font-normal text-text-muted">
            {{ t('quote.comparison.noValidity') }}
          </span>
        </td>
      </tr>
    </template>
  </BaseTable>
</template>
