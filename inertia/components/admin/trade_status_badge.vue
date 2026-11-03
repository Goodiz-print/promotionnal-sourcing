<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import { ORDER_STATUS_TONES } from '~/components/orders/types'
import { QUOTE_STATUS_TONES } from '~/components/quotes/types'
import { RFQ_STATUS_TONES, RFQ_SUPPLIER_STATUS_TONES } from '~/components/rfqs/types'
import type { BadgeTone } from '~/types/ui'

/**
 * Pastille de statut des écrans de supervision : demande, devis, commande ou
 * destinataire. Libellés et tonalités sont ceux des écrans acheteur/fournisseur.
 */
const props = defineProps<{
  kind: 'rfq' | 'quote' | 'order' | 'recipient'
  status: string
}>()

const { t } = useI18n()

const TONES: Record<typeof props.kind, Record<string, BadgeTone>> = {
  rfq: RFQ_STATUS_TONES,
  quote: QUOTE_STATUS_TONES,
  order: ORDER_STATUS_TONES,
  recipient: RFQ_SUPPLIER_STATUS_TONES,
}

const LABEL_PREFIX: Record<typeof props.kind, string> = {
  rfq: 'rfq.status',
  quote: 'quote.status',
  order: 'order.status',
  recipient: 'rfq.supplierStatus',
}
</script>

<template>
  <BaseBadge dot :tone="TONES[kind][status] ?? 'neutral'">
    {{ t(`${LABEL_PREFIX[kind]}.${status}`) }}
  </BaseBadge>
</template>
