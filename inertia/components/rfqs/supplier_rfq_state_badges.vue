<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import { SUPPLIER_RFQ_STATE_TONES } from '~/components/rfqs/types'
import type { SupplierRfqState } from '#shared/types/rfq'

/**
 * Statut lisible d'une demande reçue (#230) — à traiter, répondu, expiré,
 * décliné — suivi de la pastille « réponse tardive » quand le fournisseur a
 * répondu après l'échéance (#232).
 */
defineProps<{ state: SupplierRfqState; late: boolean }>()

const { t } = useI18n()
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-2">
    <BaseBadge dot :tone="SUPPLIER_RFQ_STATE_TONES[state]" data-test="supplier-rfq-state">
      {{ t(`rfq.supplier.state.${state}`) }}
    </BaseBadge>
    <BaseBadge v-if="late" tone="warning" data-test="late-reply">
      {{ t('rfq.lateReply') }}
    </BaseBadge>
  </span>
</template>
