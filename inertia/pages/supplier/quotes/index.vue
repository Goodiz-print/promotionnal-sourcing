<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import { formatMoney, QUOTE_STATUS_TONES } from '~/components/quotes/types'
import type { QuoteType } from '#shared/types/quote'

defineProps<{ quotes: QuoteType[] }>()

const { t, locale } = useI18n()
</script>

<template>
  <Head :title="t('quote.supplier.index.title')" />

  <div class="mx-auto flex max-w-[960px] flex-col gap-6 px-6 py-12">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('quote.supplier.index.title') }}</h1>
      <p class="text-lg text-[var(--gray-6)]">{{ t('quote.supplier.index.subtitle') }}</p>
    </div>

    <p v-if="quotes.length === 0" class="text-[var(--gray-6)]">
      {{ t('quote.supplier.index.empty') }}
    </p>

    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="quote in quotes"
        :key="quote.id"
        class="flex items-center gap-4 rounded border border-[var(--gray-3)] p-4"
      >
        <div class="flex-1">
          <Link
            route="supplier.quotes.show"
            :params="{ locale, id: quote.id }"
            class="font-medium hover:underline"
          >
            {{ quote.rfqTitle }}
          </Link>
          <p class="mt-0.5 text-sm text-[var(--gray-6)]">
            {{ formatMoney(quote.totalAmount, quote.currency, locale) }} ·
            {{ t('quote.table.days', { count: quote.leadTimeDays }) }}
          </p>
        </div>
        <BaseBadge :tone="QUOTE_STATUS_TONES[quote.status]">
          {{ t(`quote.status.${quote.status}`) }}
        </BaseBadge>
      </li>
    </ul>
  </div>
</template>
