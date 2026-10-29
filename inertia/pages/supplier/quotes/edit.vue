<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseDescriptionItem from '~/components/base/base_description_item.vue'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import QuoteForm from '~/components/quotes/quote_form.vue'
import QuoteLinesTable from '~/components/quotes/quote_lines_table.vue'
import SupplierRfqMetaPills from '~/components/rfqs/supplier_rfq_meta_pills.vue'
import { formatDay, QUOTE_STATUS_TONES } from '~/components/quotes/types'
import type { QuoteType } from '#shared/types/quote'
import type { SupplierRfqDetailType } from '#shared/types/rfq'

/**
 * Devis côté fournisseur : formulaire tant que c'est un brouillon et que la
 * demande est ouverte, lecture seule ensuite (le devis remis est figé).
 */
const props = defineProps<{
  rfq: SupplierRfqDetailType
  quote: QuoteType | null
  canEdit: boolean
}>()

const { t, locale } = useI18n()

const rfqUrl = computed(() =>
  urlFor('supplier.rfqs.show', { locale: locale.value, id: props.rfq.id })
)

/** Sans devis encore enregistré, l'écran présente un brouillon à venir. */
const status = computed(() => props.quote?.status ?? 'draft')
</script>

<template>
  <Head :title="t('quote.supplier.edit.title', { rfqTitle: rfq.title })" />

  <div class="mx-auto flex w-full max-w-[860px] flex-col gap-8">
    <BasePageHeader
      :title="t('quote.supplier.edit.title', { rfqTitle: rfq.title })"
      :back-href="rfqUrl"
      :back-label="t('quote.supplier.edit.backToRfq')"
    >
      <template #meta>
        <BaseBadge dot :tone="QUOTE_STATUS_TONES[status]">
          {{ t(`quote.status.${status}`) }}
        </BaseBadge>
        <SupplierRfqMetaPills :rfq="rfq" />
      </template>
    </BasePageHeader>

    <QuoteForm v-if="canEdit" :rfq="rfq" :quote="quote" />

    <template v-else-if="quote">
      <BaseAlert :tone="QUOTE_STATUS_TONES[quote.status]">
        {{ t(`quote.supplier.edit.notice.${quote.status}`) }}
      </BaseAlert>

      <BaseSection :title="t('quote.supplier.edit.linesTitle')" flush>
        <QuoteLinesTable :quote="quote" bare />

        <template #footer>
          <BaseDescriptionList>
            <BaseDescriptionItem :label="t('quote.form.validUntil')">
              <template v-if="quote.validUntil">{{ formatDay(quote.validUntil, locale) }}</template>
              <span v-else class="text-text-muted">{{ t('quote.comparison.noValidity') }}</span>
            </BaseDescriptionItem>
            <BaseDescriptionItem v-if="quote.notes" :label="t('quote.form.notes')" full>
              <span class="whitespace-pre-line">{{ quote.notes }}</span>
            </BaseDescriptionItem>
          </BaseDescriptionList>
        </template>
      </BaseSection>
    </template>

    <BaseAlert v-else tone="warning">{{ t('quote.errors.notAllowed') }}</BaseAlert>
  </div>
</template>
