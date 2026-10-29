<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseTable from '~/components/base/base_table.vue'
import { formatMoney } from '~/components/quotes/types'
import type { OrderType } from '#shared/types/order'

/** Lignes d'une commande, en lecture seule. Conçu pour une `BaseSection flush`. */
defineProps<{ order: OrderType }>()

const { t, locale } = useI18n()
</script>

<template>
  <BaseTable bare :caption="t('order.show.items')">
    <template #head>
      <tr>
        <th scope="col">{{ t('order.table.item') }}</th>
        <th scope="col" class="text-right">{{ t('order.table.unitPrice') }}</th>
        <th scope="col" class="text-right">{{ t('order.table.quantity') }}</th>
        <th scope="col" class="text-right">{{ t('order.table.total') }}</th>
      </tr>
    </template>

    <tr v-for="item in order.items" :key="item.id">
      <td>
        <p class="font-medium">{{ item.name }}</p>
        <p v-if="item.customizationDetails?.note" class="text-caption text-text-muted">
          {{ item.customizationDetails.note }}
        </p>
      </td>
      <td class="text-tabular text-right whitespace-nowrap">
        {{ formatMoney(item.unitPrice, order.currency, locale) }}
      </td>
      <td class="text-tabular text-right">{{ item.quantity }}</td>
      <td class="text-tabular text-right whitespace-nowrap">
        {{ formatMoney(item.totalPrice, order.currency, locale) }}
      </td>
    </tr>

    <template #foot>
      <tr>
        <td colspan="3" class="text-right">{{ t('order.table.total') }}</td>
        <td class="text-tabular text-right font-semibold whitespace-nowrap">
          {{ formatMoney(order.totalAmount, order.currency, locale) }}
        </td>
      </tr>
    </template>
  </BaseTable>
</template>
