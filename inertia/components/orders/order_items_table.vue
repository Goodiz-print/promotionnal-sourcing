<script setup lang="ts">
import { useI18n } from '~/i18n'
import { formatMoney } from '~/components/quotes/types'
import type { OrderType } from '#shared/types/order'

/** Lignes d'une commande, en lecture seule. */
defineProps<{ order: OrderType }>()

const { t, locale } = useI18n()
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-[var(--gray-3)] text-[var(--gray-6)]">
        <tr>
          <th class="py-2 pr-4 font-medium">{{ t('order.table.item') }}</th>
          <th class="py-2 pr-4 text-right font-medium">{{ t('order.table.unitPrice') }}</th>
          <th class="py-2 pr-4 text-right font-medium">{{ t('order.table.quantity') }}</th>
          <th class="py-2 text-right font-medium">{{ t('order.table.total') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in order.items" :key="item.id" class="border-b border-[var(--gray-2)]">
          <td class="py-2 pr-4">
            <p>{{ item.name }}</p>
            <p v-if="item.customizationDetails?.note" class="text-[var(--gray-6)]">
              {{ item.customizationDetails.note }}
            </p>
          </td>
          <td class="py-2 pr-4 text-right whitespace-nowrap">
            {{ formatMoney(item.unitPrice, order.currency, locale) }}
          </td>
          <td class="py-2 pr-4 text-right">{{ item.quantity }}</td>
          <td class="py-2 text-right whitespace-nowrap">
            {{ formatMoney(item.totalPrice, order.currency, locale) }}
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" class="py-2 pr-4 text-right font-medium">{{ t('order.table.total') }}</td>
          <td class="py-2 text-right font-medium whitespace-nowrap">
            {{ formatMoney(order.totalAmount, order.currency, locale) }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
