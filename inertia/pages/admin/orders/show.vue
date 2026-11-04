<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import TradeLinesTable from '~/components/admin/trade_lines_table.vue'
import TradeStatusBadge from '~/components/admin/trade_status_badge.vue'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { AdminOrderDetail } from '#shared/types/admin_trade'

const props = defineProps<{ detail: AdminOrderDetail }>()

const { t, locale } = useI18n()
const { money, dateTime } = useTradeFormat()

const summary = computed(() => {
  const { item } = props.detail
  return [
    { label: t('admin.trade.columns.buyer'), value: item.buyer.name },
    { label: t('admin.trade.columns.supplier'), value: item.supplier.name },
    { label: t('admin.trade.columns.amount'), value: money(item.totalAmount, item.currency) },
    { label: t('admin.orders.columns.created'), value: dateTime(item.createdAt) },
  ]
})

/** Jalons de la commande ; un jalon non atteint n'est pas affiché. */
const milestones = computed(() =>
  (
    [
      ['confirmed', props.detail.confirmedAt],
      ['inProduction', props.detail.inProductionAt],
      ['shipped', props.detail.shippedAt],
      ['delivered', props.detail.deliveredAt],
      ['cancelled', props.detail.cancelledAt],
    ] as const
  ).map(([key, value]) => ({
    label: t(`admin.orders.detail.milestones.${key}`),
    value: value ? dateTime(value) : null,
  }))
)
</script>

<template>
  <Head :title="t('admin.orders.number', { id: detail.item.id })" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('admin.orders.number', { id: detail.item.id })"
      :back-href="urlFor('admin.orders.index', { locale })"
      :back-label="t('admin.orders.back')"
    >
      <template #meta><TradeStatusBadge kind="order" :status="detail.item.status" /></template>
      <template #actions>
        <BaseLinkButton
          :href="urlFor('admin.quotes.show', { locale, id: detail.item.quoteId })"
          variant="secondary"
          size="sm"
        >
          {{ t('admin.orders.detail.viewQuote') }}
        </BaseLinkButton>
      </template>
    </BasePageHeader>

    <BaseSection :title="t('admin.trade.summary')">
      <BaseDescriptionList :items="summary" />
    </BaseSection>

    <BaseSection :title="t('admin.orders.detail.progress')">
      <BaseDescriptionList :items="milestones" :columns="3" />
    </BaseSection>

    <TradeLinesTable :lines="detail.items" :currency="detail.item.currency" />
  </div>
</template>
