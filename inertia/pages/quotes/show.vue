<script setup lang="ts">
import { computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { CalendarDays, Check, PackageCheck, X } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import QuoteLinesTable from '~/components/quotes/quote_lines_table.vue'
import { formatDay, QUOTE_STATUS_TONES } from '~/components/quotes/types'
import type { QuoteType } from '#shared/types/quote'

/**
 * Devis remis, côté acheteur. Accepter rejette d'office les autres devis et
 * clôture la demande — d'où la confirmation ; rejeter laisse la demande ouverte.
 */
const props = defineProps<{ quote: QuoteType; canDecide: boolean; orderId?: number }>()

const { t, locale } = useI18n()

const rfqUrl = computed(() => urlFor('rfqs.show', { locale: locale.value, id: props.quote.rfqId }))

const orderUrl = computed(() =>
  props.orderId ? urlFor('orders.show', { locale: locale.value, id: props.orderId }) : ''
)

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

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('quote.show.title', { supplierName: quote.supplierName })"
      :back-href="rfqUrl"
      :back-label="t('quote.show.backToRfq', { rfqTitle: quote.rfqTitle })"
    >
      <template #meta>
        <BaseBadge dot :tone="QUOTE_STATUS_TONES[quote.status]">
          {{ t(`quote.status.${quote.status}`) }}
        </BaseBadge>
        <span
          v-if="quote.validUntil"
          class="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-card px-3 py-1 text-caption text-text-secondary"
        >
          <CalendarDays :size="14" aria-hidden="true" />
          {{ t('quote.form.validUntilOn', { date: formatDay(quote.validUntil, locale) }) }}
        </span>
      </template>

      <template v-if="canDecide || orderId" #actions>
        <BaseLinkButton v-if="orderId" :href="orderUrl" variant="secondary">
          <PackageCheck :size="18" aria-hidden="true" />
          {{ t('order.viewOrder') }}
        </BaseLinkButton>
        <template v-if="canDecide">
          <BaseButton variant="danger" @click="decide('reject')">
            <template #icon><X :size="18" aria-hidden="true" /></template>
            {{ t('quote.show.reject') }}
          </BaseButton>
          <BaseButton @click="decide('accept')">
            <template #icon><Check :size="18" aria-hidden="true" /></template>
            {{ t('quote.show.accept') }}
          </BaseButton>
        </template>
      </template>
    </BasePageHeader>

    <BaseSection :title="t('quote.show.lines')" flush>
      <QuoteLinesTable :quote="quote" />
    </BaseSection>

    <BaseSection v-if="quote.notes" :title="t('quote.form.notes')">
      <p class="whitespace-pre-line text-body-md text-text-secondary">{{ quote.notes }}</p>
    </BaseSection>
  </div>
</template>
