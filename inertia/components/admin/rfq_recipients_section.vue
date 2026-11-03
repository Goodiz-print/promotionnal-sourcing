<script setup lang="ts">
import { useI18n } from '~/i18n'
import { useTradeFormat } from '~/composables/use_trade_format'
import TradeStatusBadge from '~/components/admin/trade_status_badge.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminRfqRecipient } from '#shared/types/admin_trade'

/** Destinataires d'une demande : statut, date d'envoi et de dernière relance. */
defineProps<{ recipients: AdminRfqRecipient[] }>()

const { t } = useI18n()
const { dateTime } = useTradeFormat()
</script>

<template>
  <BaseSection :title="t('admin.rfqs.detail.recipients')" flush>
    <p v-if="recipients.length === 0" class="p-6 text-body-sm text-text-secondary">
      {{ t('admin.rfqs.detail.noRecipients') }}
    </p>
    <BaseTable v-else bare :caption="t('admin.rfqs.detail.recipients')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.trade.columns.supplier') }}</th>
          <th scope="col">{{ t('admin.trade.columns.status') }}</th>
          <th scope="col">{{ t('admin.rfqs.detail.sentAt') }}</th>
          <th scope="col">{{ t('admin.rfqs.detail.remindedAt') }}</th>
        </tr>
      </template>
      <tr v-for="recipient in recipients" :key="recipient.id">
        <td class="font-semibold text-text-primary">{{ recipient.supplier.name }}</td>
        <td><TradeStatusBadge kind="recipient" :status="recipient.status" /></td>
        <td class="text-tabular whitespace-nowrap">{{ dateTime(recipient.sentAt) }}</td>
        <td class="text-tabular whitespace-nowrap">{{ dateTime(recipient.remindedAt) }}</td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
