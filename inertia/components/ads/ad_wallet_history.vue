<script setup lang="ts">
import { useI18n } from '~/i18n'
import { useAdFormat } from '~/composables/use_ad_format'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdWalletTransactionType } from '#shared/types/ads'

/** Derniers mouvements du portefeuille publicitaire (recharges, ajustements, clics). */
defineProps<{ transactions: AdWalletTransactionType[] }>()

const { t } = useI18n()
const { money, dateTime } = useAdFormat()
</script>

<template>
  <BaseSection :title="t('ads.wallet.history')" flush>
    <BaseTable bare :caption="t('ads.wallet.history')">
      <template #head>
        <tr>
          <th scope="col">{{ t('ads.wallet.columns.date') }}</th>
          <th scope="col">{{ t('ads.wallet.columns.type') }}</th>
          <th scope="col" class="text-right">{{ t('ads.wallet.columns.amount') }}</th>
          <th scope="col" class="text-right">{{ t('ads.wallet.columns.balance') }}</th>
        </tr>
      </template>

      <tr v-for="transaction in transactions" :key="transaction.id">
        <td class="whitespace-nowrap">{{ dateTime(transaction.createdAt) }}</td>
        <td>
          {{ t(`ads.wallet.types.${transaction.type}`) }}
          <span v-if="transaction.note" class="block text-caption text-text-muted">
            {{ transaction.note }}
          </span>
        </td>
        <td
          class="text-tabular text-right whitespace-nowrap"
          :class="transaction.amountCents < 0 ? 'text-text-secondary' : 'text-success'"
        >
          {{ money(transaction.amountCents) }}
        </td>
        <td class="text-tabular text-right whitespace-nowrap">
          {{ money(transaction.balanceAfterCents) }}
        </td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
