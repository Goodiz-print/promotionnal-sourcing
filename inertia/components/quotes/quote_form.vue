<script setup lang="ts">
import { computed } from 'vue'
import { router, useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useConfirm } from '~/composables/use_confirm'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import QuoteLinesFields from '~/components/quotes/quote_lines_fields.vue'
import {
  formatMoney,
  lineTotal,
  type QuoteFormState,
  type QuoteLineState,
} from '~/components/quotes/types'
import { DEFAULT_QUOTE_CURRENCY } from '#shared/types/quote'
import type { QuoteType } from '#shared/types/quote'
import type { SupplierRfqDetailType } from '#shared/types/rfq'

/**
 * Formulaire de devis, en création comme en édition d'un brouillon. Seules les
 * lignes chiffrées (prix renseigné) sont envoyées ; le serveur recalcule tous
 * les montants. « Remettre » est une action distincte de « Enregistrer » : elle
 * rend le devis définitif, d'où l'obligation d'avoir enregistré d'abord.
 */
const props = defineProps<{ rfq: SupplierRfqDetailType; quote: QuoteType | null }>()

const { t, locale } = useI18n()
const { confirm } = useConfirm()

const currency = props.quote?.currency ?? DEFAULT_QUOTE_CURRENCY

function initialLine(rfqItemId: number, quantity: number): QuoteLineState {
  const existing = props.quote?.items.find((item) => item.rfqItemId === rfqItemId)
  return {
    rfqItemId,
    unitPrice: existing?.unitPrice ?? null,
    quantity: existing?.quantity ?? quantity,
    leadTimeDays: existing?.leadTimeDays ?? null,
    customization: existing?.customizationDetails?.note ?? '',
  }
}

const form = useForm<QuoteFormState>({
  validUntil: props.quote?.validUntil ?? '',
  notes: props.quote?.notes ?? '',
  lines: props.rfq.items.map((item) => initialLine(item.id, item.quantity)),
})

/** Lignes réellement envoyées : celles dont le prix est renseigné. */
const pricedIndexes = computed(() =>
  form.lines.flatMap((line, index) => (line.unitPrice === null ? [] : [index]))
)

/**
 * Les erreurs du serveur portent l'index dans les lignes *envoyées* ; on les
 * ramène à l'index de la ligne affichée.
 */
const lineErrors = computed(() => {
  const remapped: Record<string, string> = {}
  for (const [key, message] of Object.entries(form.errors as Record<string, string>)) {
    const match = key.match(/^items\.(\d+)\.(.+)$/)
    const index = match ? pricedIndexes.value[Number(match[1])] : undefined
    remapped[match && index !== undefined ? `items.${index}.${match[2]}` : key] = message
  }
  return remapped
})

const total = computed(() => form.lines.reduce((sum, line) => sum + (lineTotal(line) ?? 0), 0))

function save() {
  form
    .transform((data) => ({
      validUntil: data.validUntil || null,
      notes: data.notes || null,
      items: data.lines
        .filter((line) => line.unitPrice !== null)
        .map((line) => ({
          rfqItemId: line.rfqItemId,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          leadTimeDays: line.leadTimeDays ?? 0,
          customizationDetails: line.customization ? { note: line.customization } : null,
        })),
    }))
    [props.quote ? 'patch' : 'post'](
      props.quote
        ? urlFor('supplier.quotes.update', { locale: locale.value, id: props.quote.id })
        : urlFor('supplier.quotes.store', { locale: locale.value, rfqId: props.rfq.id }),
      { preserveScroll: true }
    )
}

async function submitQuote() {
  if (!props.quote) return
  const confirmed = await confirm({
    message: t('quote.form.confirmSubmit'),
    confirmLabel: t('quote.form.submit'),
  })
  if (!confirmed) return
  router.post(
    urlFor('supplier.quotes.submit', { locale: locale.value, id: props.quote.id }),
    {},
    { preserveScroll: true }
  )
}

async function destroyQuote() {
  if (!props.quote) return
  const confirmed = await confirm({
    message: t('quote.form.confirmDelete'),
    confirmLabel: t('quote.form.delete'),
    tone: 'danger',
  })
  if (!confirmed) return
  router.delete(urlFor('supplier.quotes.destroy', { locale: locale.value, id: props.quote.id }))
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="save">
    <BaseSection
      as="fieldset"
      :title="t('quote.form.sections.lines')"
      :description="t('quote.form.sections.linesHint')"
    >
      <div class="flex flex-col gap-4">
        <QuoteLinesFields
          v-model="form.lines"
          :items="rfq.items"
          :currency="currency"
          :errors="lineErrors"
        />
        <p v-if="lineErrors.items" role="alert" class="text-caption font-medium text-danger">
          {{ lineErrors.items }}
        </p>
      </div>
    </BaseSection>

    <BaseSection as="fieldset" :title="t('quote.form.sections.terms')">
      <div class="grid gap-5 sm:grid-cols-2">
        <BaseInput
          id="quote-valid-until"
          v-model="form.validUntil"
          type="date"
          :label="t('quote.form.validUntil')"
          :error="form.errors.validUntil"
        />
        <BaseTextarea
          id="quote-notes"
          v-model="form.notes"
          :label="t('quote.form.notes')"
          :error="form.errors.notes"
          class="sm:col-span-2"
        />
      </div>

      <template #footer>
        <p class="text-tabular text-heading-sm text-text-primary">
          {{ t('quote.form.total', { total: formatMoney(total, currency, locale) }) }}
        </p>
      </template>
    </BaseSection>

    <div
      class="sticky bottom-4 z-20 flex items-center justify-end gap-3 rounded-xl border border-hairline bg-white/90 px-4 py-3 shadow-elevation-2 backdrop-blur-md"
    >
      <BaseButton v-if="quote" variant="danger" @click="destroyQuote()">
        {{ t('quote.form.delete') }}
      </BaseButton>
      <BaseButton
        v-if="quote"
        variant="secondary"
        :disabled="form.isDirty"
        :title="form.isDirty ? t('quote.form.saveFirst') : undefined"
        @click="submitQuote()"
      >
        {{ t('quote.form.submit') }}
      </BaseButton>
      <BaseButton type="submit" :loading="form.processing" :disabled="pricedIndexes.length === 0">
        {{ t('quote.form.save') }}
      </BaseButton>
    </div>
  </form>
</template>
