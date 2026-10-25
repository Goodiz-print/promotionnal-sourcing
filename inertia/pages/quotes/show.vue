<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import QuoteLinesTable from '~/components/quotes/quote_lines_table.vue'
import { formatDay, QUOTE_STATUS_TONES } from '~/components/quotes/types'
import type { QuoteType } from '#shared/types/quote'

/**
 * Devis remis, côté acheteur. Accepter rejette d'office les autres devis et
 * clôture la demande — d'où la confirmation ; rejeter laisse la demande ouverte.
 */
const props = defineProps<{ quote: QuoteType; canDecide: boolean }>()

const { t, locale } = useI18n()

function decide(decision: 'accept' | 'reject') {
  if (!window.confirm(t(`quote.show.confirm.${decision}`))) return
  router.patch(
    urlFor(decision === 'accept' ? 'quotes.accept' : 'quotes.reject', {
      locale: locale.value,
      id: props.quote.id,
    }),
    {},
    { preserveScroll: true }
  )
}
</script>

<template>
  <Head :title="t('quote.show.title', { supplierName: quote.supplierName })" />

  <div class="mx-auto flex max-w-[860px] flex-col gap-8 px-6 py-12">
    <div>
      <Link
        route="rfqs.show"
        :params="{ locale, id: quote.rfqId }"
        class="text-sm text-[var(--color-primary)] hover:underline"
      >
        {{ t('quote.show.backToRfq', { rfqTitle: quote.rfqTitle }) }}
      </Link>

      <div class="mt-3 flex items-start justify-between gap-4">
        <h1 class="text-[32px] tracking-[-0.5px]">
          {{ t('quote.show.title', { supplierName: quote.supplierName }) }}
        </h1>
        <BaseBadge :tone="QUOTE_STATUS_TONES[quote.status]">
          {{ t(`quote.status.${quote.status}`) }}
        </BaseBadge>
      </div>
      <p v-if="quote.validUntil" class="mt-1 text-sm text-[var(--gray-6)]">
        {{ t('quote.form.validUntilOn', { date: formatDay(quote.validUntil, locale) }) }}
      </p>
    </div>

    <QuoteLinesTable :quote="quote" />

    <section v-if="quote.notes" class="flex flex-col gap-2">
      <h2 class="font-medium">{{ t('quote.form.notes') }}</h2>
      <p class="whitespace-pre-line text-[var(--gray-8)]">{{ quote.notes }}</p>
    </section>

    <div v-if="canDecide" class="flex flex-wrap items-center gap-3">
      <BaseButton variant="secondary" @click="decide('accept')">
        {{ t('quote.show.accept') }}
      </BaseButton>
      <BaseButton variant="danger" @click="decide('reject')">
        {{ t('quote.show.reject') }}
      </BaseButton>
    </div>
  </div>
</template>
