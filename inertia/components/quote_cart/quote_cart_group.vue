<script setup lang="ts">
import { useI18n } from '~/i18n'
import { formatMoney } from '~/components/quotes/types'
import BaseSection from '~/components/base/base_section.vue'
import QuoteCartLine from '~/components/quote_cart/quote_cart_line.vue'
import type { QuoteCartGroupType } from '#shared/types/quote_cart'

/**
 * Les produits d'un même fournisseur : ils partiront dans une seule demande.
 * Le groupe sans fournisseur joignable est signalé comme tel.
 */
const props = defineProps<{ group: QuoteCartGroupType }>()

const { t, locale } = useI18n()

const reachable = props.group.supplierOrganizationId !== null
</script>

<template>
  <BaseSection
    :title="reachable ? (group.supplierName ?? '') : t('quote_cart.group.unreachable')"
    :description="
      reachable
        ? t('quote_cart.group.items', { count: group.items.length })
        : t('quote_cart.group.unreachableDescription')
    "
    data-testid="quote-cart-group"
  >
    <ul class="-my-4 flex flex-col divide-y divide-hairline">
      <QuoteCartLine v-for="item in group.items" :key="item.id" :item="item" />
    </ul>

    <div
      v-if="reachable && group.subtotals.length > 0"
      class="mt-4 flex flex-col items-end gap-1 border-t border-hairline pt-4"
      data-testid="quote-cart-subtotal"
    >
      <p
        v-for="subtotal in group.subtotals"
        :key="subtotal.currency"
        class="text-tabular text-body-md font-semibold text-text-primary"
      >
        {{
          t(
            group.estimateComplete
              ? 'quote_cart.estimate.subtotal'
              : 'quote_cart.estimate.subtotalPartial',
            {
              amount: formatMoney(Number(subtotal.total), subtotal.currency, locale),
            }
          )
        }}
      </p>
      <p class="text-caption text-text-muted">{{ t('quote_cart.estimate.disclaimer') }}</p>
    </div>
  </BaseSection>
</template>
