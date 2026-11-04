<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { usePlatformPermissions } from '~/composables/use_platform_permissions'
import { useTradeFormat } from '~/composables/use_trade_format'
import RfqInterventionActions from '~/components/admin/rfq_intervention_actions.vue'
import RfqQuotesSection from '~/components/admin/rfq_quotes_section.vue'
import RfqRecipientsSection from '~/components/admin/rfq_recipients_section.vue'
import TradeStatusBadge from '~/components/admin/trade_status_badge.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminRfqDetail } from '#shared/types/admin_trade'

const props = defineProps<{ detail: AdminRfqDetail }>()

const { t, locale } = useI18n()
const { can } = usePlatformPermissions()
const { dateTime } = useTradeFormat()

const canIntervene = computed(
  () =>
    can('trade.manage') &&
    (props.detail.canClose || props.detail.canExpire || props.detail.remindableCount > 0)
)

const summary = computed(() => [
  { label: t('admin.trade.columns.buyer'), value: props.detail.item.buyer.name },
  { label: t('admin.rfqs.detail.createdBy'), value: props.detail.createdByEmail },
  { label: t('admin.rfqs.columns.deadline'), value: dateTime(props.detail.item.deadline) },
  { label: t('admin.rfqs.detail.publishedAt'), value: dateTime(props.detail.item.publishedAt) },
  { label: t('admin.rfqs.detail.budgetMax'), value: props.detail.budgetMax },
  { label: t('admin.rfqs.detail.description'), value: props.detail.description },
])
</script>

<template>
  <Head :title="detail.item.title" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="detail.item.title"
      :back-href="urlFor('admin.rfqs.index', { locale })"
      :back-label="t('admin.rfqs.back')"
    >
      <template #meta>
        <TradeStatusBadge kind="rfq" :status="detail.item.status" />
        <BaseBadge v-if="detail.item.attention" tone="warning">
          {{ t(`admin.rfqs.attention.${detail.item.attention}`) }}
        </BaseBadge>
      </template>
      <template v-if="canIntervene" #actions>
        <RfqInterventionActions :detail="detail" />
      </template>
    </BasePageHeader>

    <BaseSection :title="t('admin.trade.summary')">
      <BaseDescriptionList :items="summary" />
    </BaseSection>

    <BaseSection :title="t('admin.rfqs.detail.items')" flush>
      <BaseTable bare :caption="t('admin.rfqs.detail.items')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.trade.columns.item') }}</th>
            <th scope="col" class="text-right">{{ t('admin.trade.columns.quantity') }}</th>
            <th scope="col">{{ t('admin.rfqs.detail.unit') }}</th>
          </tr>
        </template>
        <tr v-for="line in detail.items" :key="line.id">
          <td class="font-semibold text-text-primary">
            {{ line.name }}
            <span
              v-if="line.description"
              class="block text-caption font-normal text-text-secondary"
            >
              {{ line.description }}
            </span>
          </td>
          <td class="text-tabular text-right">{{ line.quantity }}</td>
          <td>{{ line.unit ?? '—' }}</td>
        </tr>
      </BaseTable>
    </BaseSection>

    <RfqRecipientsSection :recipients="detail.recipients" />
    <RfqQuotesSection :quotes="detail.quotes" />
  </div>
</template>
