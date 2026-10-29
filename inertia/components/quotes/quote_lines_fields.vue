<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import { formatMoney, lineTotal, type QuoteLineState } from '~/components/quotes/types'
import type { RfqItemType } from '#shared/types/rfq'

/**
 * Une carte par item de la demande : le fournisseur chiffre ce qu'il propose
 * (prix unitaire, quantité, délai, personnalisation). Une ligne sans prix reste
 * non chiffrée. Le total de ligne affiché est indicatif — le serveur recalcule.
 */
const props = defineProps<{
  items: RfqItemType[]
  currency: string
  errors: Record<string, string>
}>()

const lines = defineModel<QuoteLineState[]>({ required: true })

const { t, locale } = useI18n()

function itemOf(line: QuoteLineState): RfqItemType | undefined {
  return props.items.find((item) => item.id === line.rfqItemId)
}
</script>

<template>
  <ul class="flex flex-col gap-4">
    <li
      v-for="(line, index) in lines"
      :key="line.rfqItemId"
      class="flex flex-col gap-4 rounded-lg border border-hairline bg-sunken p-4"
    >
      <div class="flex items-baseline justify-between gap-4">
        <p class="text-body-md font-semibold text-text-primary">{{ itemOf(line)?.name }}</p>
        <span class="text-tabular text-caption whitespace-nowrap text-text-secondary">
          {{ t('quote.form.requested', { quantity: itemOf(line)?.quantity ?? 0 }) }}
        </span>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <BaseInput
          :id="`quote-price-${line.rfqItemId}`"
          v-model="line.unitPrice"
          type="number"
          :min="0"
          :label="t('quote.form.unitPrice', { currency })"
          :error="errors[`items.${index}.unitPrice`]"
        />
        <BaseInput
          :id="`quote-quantity-${line.rfqItemId}`"
          v-model="line.quantity"
          type="number"
          :min="1"
          :label="t('quote.form.quantity')"
          :error="errors[`items.${index}.quantity`]"
        />
        <BaseInput
          :id="`quote-lead-${line.rfqItemId}`"
          v-model="line.leadTimeDays"
          type="number"
          :min="0"
          :label="t('quote.form.leadTime')"
          :error="errors[`items.${index}.leadTimeDays`]"
        />
      </div>

      <BaseInput
        :id="`quote-custom-${line.rfqItemId}`"
        v-model="line.customization"
        :label="t('quote.form.customization')"
        :placeholder="t('quote.form.customizationHint')"
      />

      <p
        v-if="lineTotal(line) !== null"
        class="text-tabular text-body-sm font-semibold text-text-primary"
      >
        {{ t('quote.form.lineTotal', { total: formatMoney(lineTotal(line)!, currency, locale) }) }}
      </p>
    </li>
  </ul>
</template>
