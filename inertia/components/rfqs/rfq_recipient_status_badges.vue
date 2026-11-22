<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import { RFQ_SUPPLIER_STATUS_TONES } from '~/components/rfqs/types'
import type { RfqSupplierStatus } from '#shared/types/rfq'

/**
 * Statut d'un destinataire de demande, suivi de la pastille « réponse tardive »
 * quand il a répondu après l'échéance (#232). `labels` choisit le point de vue :
 * `rfq.supplierStatus` côté agence, `rfq.supplier.status` côté fournisseur.
 */
defineProps<{
  status: RfqSupplierStatus
  late: boolean
  labels: 'rfq.supplierStatus' | 'rfq.supplier.status'
}>()

const { t } = useI18n()
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-2">
    <BaseBadge dot :tone="RFQ_SUPPLIER_STATUS_TONES[status]">
      {{ t(`${labels}.${status}`) }}
    </BaseBadge>
    <BaseBadge v-if="late" tone="warning" data-test="late-reply">
      {{ t('rfq.lateReply') }}
    </BaseBadge>
  </span>
</template>
