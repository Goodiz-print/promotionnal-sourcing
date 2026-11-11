<script setup lang="ts">
import { TrendingDown } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { formatMoney } from '~/components/quotes/types'
import type { QuoteCartEstimateType } from '#shared/types/quote_cart'

/**
 * Estimation indicative d'une ligne, d'après les grilles dégressives du
 * fournisseur : prix unitaire du palier atteint, marquage, frais techniques,
 * total, et palier suivant. « Prix sur devis » sans grille.
 */
defineProps<{ estimate: QuoteCartEstimateType | null }>()

const { t, locale } = useI18n()

/** Prix unitaire : jusqu'à 4 décimales (précision des grilles). */
function unit(amount: string, currency: string): string {
  return new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(amount))
}

function money(amount: string, currency: string): string {
  return formatMoney(Number(amount), currency, locale.value)
}
</script>

<template>
  <div class="flex flex-col gap-1 text-body-sm" data-testid="quote-cart-estimate">
    <p v-if="!estimate" class="text-text-muted">{{ t('quote_cart.estimate.onRequest') }}</p>

    <template v-else>
      <dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
        <template v-if="estimate.unitPrice !== null">
          <dt class="text-text-secondary">{{ t('quote_cart.estimate.unitPrice') }}</dt>
          <dd class="text-tabular text-right text-text-primary">
            {{ unit(estimate.unitPrice, estimate.currency) }}
          </dd>
        </template>
        <template v-if="estimate.markingUnitPrice !== null">
          <dt class="text-text-secondary">{{ t('quote_cart.estimate.markingUnitPrice') }}</dt>
          <dd class="text-tabular text-right text-text-primary">
            {{ unit(estimate.markingUnitPrice, estimate.currency) }}
          </dd>
        </template>
        <template v-if="estimate.setupCharge !== null">
          <dt class="text-text-secondary">{{ t('quote_cart.estimate.setupCharge') }}</dt>
          <dd class="text-tabular text-right text-text-primary">
            {{ money(estimate.setupCharge, estimate.currency) }}
          </dd>
        </template>
        <template v-if="estimate.total !== null">
          <dt class="font-semibold text-text-primary">
            {{
              t(estimate.partial ? 'quote_cart.estimate.totalPartial' : 'quote_cart.estimate.total')
            }}
          </dt>
          <dd class="text-tabular text-right font-semibold text-indigo-600">
            {{ money(estimate.total, estimate.currency) }}
          </dd>
        </template>
      </dl>

      <p v-if="estimate.belowFirstTier" class="text-caption text-text-muted">
        {{ t('quote_cart.estimate.belowFirstTier') }}
      </p>
      <p
        v-if="estimate.nextTier"
        class="flex items-center gap-1.5 text-caption text-text-secondary"
        data-testid="quote-cart-next-tier"
      >
        <TrendingDown :size="14" aria-hidden="true" />
        {{
          t('quote_cart.estimate.nextTier', {
            count: estimate.nextTier.minQuantity,
            price: unit(estimate.nextTier.unitPrice, estimate.nextTier.currency),
          })
        }}
      </p>
    </template>
  </div>
</template>
