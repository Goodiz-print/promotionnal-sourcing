<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import QuoteForm from '~/components/quotes/quote_form.vue'
import QuoteLinesTable from '~/components/quotes/quote_lines_table.vue'
import { formatDay, QUOTE_STATUS_TONES } from '~/components/quotes/types'
import type { QuoteType } from '#shared/types/quote'
import type { SupplierRfqDetailType } from '#shared/types/rfq'

/**
 * Devis côté fournisseur : formulaire tant que c'est un brouillon et que la
 * demande est ouverte, lecture seule ensuite (le devis remis est figé).
 */
defineProps<{
  rfq: SupplierRfqDetailType
  quote: QuoteType | null
  canEdit: boolean
}>()

const { t, locale } = useI18n()
</script>

<template>
  <Head :title="t('quote.supplier.edit.title', { rfqTitle: rfq.title })" />

  <div class="mx-auto flex max-w-[860px] flex-col gap-8 px-6 py-12">
    <div>
      <Link
        route="supplier.rfqs.show"
        :params="{ locale, id: rfq.id }"
        class="text-sm text-[var(--color-primary)] hover:underline"
      >
        {{ t('quote.supplier.edit.backToRfq') }}
      </Link>

      <div class="mt-3 flex items-start justify-between gap-4">
        <h1 class="text-[32px] tracking-[-0.5px]">
          {{ t('quote.supplier.edit.title', { rfqTitle: rfq.title }) }}
        </h1>
        <BaseBadge :tone="QUOTE_STATUS_TONES[quote?.status ?? 'draft']">
          {{ t(`quote.status.${quote?.status ?? 'draft'}`) }}
        </BaseBadge>
      </div>
      <p class="mt-1 text-sm text-[var(--gray-6)]">
        {{ t('rfq.supplier.show.buyer') }} : {{ rfq.buyerName }}
      </p>
    </div>

    <QuoteForm v-if="canEdit" :rfq="rfq" :quote="quote" />

    <template v-else-if="quote">
      <p class="text-sm text-[var(--gray-6)]">
        {{ t(`quote.supplier.edit.notice.${quote.status}`) }}
      </p>
      <QuoteLinesTable :quote="quote" />
      <p v-if="quote.validUntil" class="text-sm text-[var(--gray-8)]">
        {{ t('quote.form.validUntilOn', { date: formatDay(quote.validUntil, locale) }) }}
      </p>
      <p v-if="quote.notes" class="text-sm whitespace-pre-line text-[var(--gray-8)]">
        {{ quote.notes }}
      </p>
    </template>

    <p v-else class="text-sm text-[var(--gray-6)]">{{ t('quote.errors.notAllowed') }}</p>
  </div>
</template>
