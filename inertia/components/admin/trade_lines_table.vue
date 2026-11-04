<script setup lang="ts">
import { useI18n } from '~/i18n'
import { useTradeFormat } from '~/composables/use_trade_format'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { TradeLine } from '~/components/admin/types'

/** Lignes chiffrées d'un devis ou d'une commande ; `leadTime` ajoute la colonne délai (devis). */
defineProps<{ lines: TradeLine[]; currency: string; leadTime?: boolean }>()

const { t } = useI18n()
const { money } = useTradeFormat()
</script>

<template>
  <BaseSection :title="t('admin.trade.lines')" flush>
    <BaseTable bare :caption="t('admin.trade.lines')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.trade.columns.item') }}</th>
          <th scope="col" class="text-right">{{ t('admin.trade.columns.quantity') }}</th>
          <th scope="col" class="text-right">{{ t('admin.trade.columns.unitPrice') }}</th>
          <th scope="col" class="text-right">{{ t('admin.trade.columns.total') }}</th>
          <th v-if="leadTime" scope="col" class="text-right">
            {{ t('admin.quotes.detail.leadTime') }}
          </th>
        </tr>
      </template>
      <tr v-for="line in lines" :key="line.id">
        <td class="font-semibold text-text-primary">{{ line.name }}</td>
        <td class="text-tabular text-right">{{ line.quantity }}</td>
        <td class="text-tabular text-right">{{ money(line.unitPrice, currency) }}</td>
        <td class="text-tabular text-right">{{ money(line.totalPrice, currency) }}</td>
        <td v-if="leadTime" class="text-tabular text-right">
          {{ t('admin.quotes.detail.days', { count: line.leadTimeDays ?? 0 }) }}
        </td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
