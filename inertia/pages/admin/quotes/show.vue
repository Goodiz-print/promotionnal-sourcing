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
import type { AdminQuoteDetail } from '#shared/types/admin_trade'

const props = defineProps<{ detail: AdminQuoteDetail }>()

const { t, locale } = useI18n()
const { money, dateTime } = useTradeFormat()

const lines = computed(() =>
  props.detail.items.map((line) => ({ ...line, name: line.rfqItemName }))
)

const summary = computed(() => {
  const { item } = props.detail
  return [
    { label: t('admin.trade.columns.buyer'), value: item.buyer.name },
    { label: t('admin.trade.columns.supplier'), value: item.supplier.name },
    { label: t('admin.trade.columns.amount'), value: money(item.totalAmount, item.currency) },
    { label: t('admin.quotes.columns.submitted'), value: dateTime(item.submittedAt) },
    { label: t('admin.quotes.detail.validUntil'), value: dateTime(item.validUntil) },
    { label: t('admin.quotes.detail.decidedAt'), value: dateTime(props.detail.decidedAt) },
    { label: t('admin.quotes.detail.notes'), value: props.detail.notes },
  ]
})
</script>

<template>
  <Head :title="t('admin.quotes.number', { id: detail.item.id })" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('admin.quotes.number', { id: detail.item.id })"
      :description="detail.item.rfqTitle"
      :back-href="urlFor('admin.quotes.index', { locale })"
      :back-label="t('admin.quotes.back')"
    >
      <template #meta><TradeStatusBadge kind="quote" :status="detail.item.status" /></template>
      <template #actions>
        <BaseLinkButton
          :href="urlFor('admin.rfqs.show', { locale, id: detail.item.rfqId })"
          variant="secondary"
          size="sm"
        >
          {{ t('admin.quotes.detail.viewRfq') }}
        </BaseLinkButton>
        <BaseLinkButton
          v-if="detail.orderId"
          :href="urlFor('admin.orders.show', { locale, id: detail.orderId })"
          variant="secondary"
          size="sm"
        >
          {{ t('admin.quotes.detail.viewOrder') }}
        </BaseLinkButton>
      </template>
    </BasePageHeader>

    <BaseSection :title="t('admin.trade.summary')">
      <BaseDescriptionList :items="summary" />
    </BaseSection>

    <TradeLinesTable :lines="lines" :currency="detail.item.currency" lead-time />
  </div>
</template>
