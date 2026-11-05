<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { MessagesSquare } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import TradeList from '~/components/admin/trade_list.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import type { AdminConversationFilters, AdminConversationRow } from '#shared/types/admin_messaging'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<{
  conversations: Paginated<AdminConversationRow>
  filters: AdminConversationFilters
}>()

const { t, locale } = useI18n()
const { dateTime } = useTradeFormat()

const model = reactive({ ...props.filters })
// Les filtres du serveur font foi (retour arrière, pagination…).
watch(
  () => props.filters,
  () => Object.assign(model, props.filters),
  { deep: true }
)

function visit(page = 1) {
  const query: Record<string, string | number> = { page }
  if (model.buyer?.trim()) query.buyer = model.buyer.trim()
  if (model.supplier?.trim()) query.supplier = model.supplier.trim()
  if (model.withOpenReports) query.withOpenReports = 1
  if (model.blocked) query.blocked = 1
  router.get(urlFor('admin.messaging.index', { locale: locale.value }), query, {
    preserveState: true,
    preserveScroll: true,
    only: ['conversations', 'filters'],
  })
}

function reset() {
  Object.assign(model, { buyer: null, supplier: null, withOpenReports: false, blocked: false })
  visit()
}

const showUrl = (row: AdminConversationRow) =>
  urlFor('admin.messaging.show', { locale: locale.value, id: row.id })
</script>

<template>
  <Head :title="t('admin.messaging.title')" />

  <TradeList
    :title="t('admin.messaging.title')"
    :description="t('admin.messaging.subtitle')"
    :count-label="t('admin.messaging.resultsCount', { count: conversations.meta.total })"
    :empty-title="t('admin.messaging.empty')"
    :empty-description="t('admin.messaging.emptyDescription')"
    :icon="MessagesSquare"
    :meta="conversations.meta"
    @page="visit"
  >
    <template #filters>
      <BaseCard padding="md">
        <form class="flex flex-col gap-4" @submit.prevent="visit()">
          <div class="grid gap-4 sm:grid-cols-2">
            <BaseInput
              id="messaging-buyer"
              :model-value="model.buyer ?? ''"
              :label="t('admin.trade.filters.buyer')"
              @update:model-value="model.buyer = $event"
            />
            <BaseInput
              id="messaging-supplier"
              :model-value="model.supplier ?? ''"
              :label="t('admin.trade.filters.supplier')"
              @update:model-value="model.supplier = $event"
            />
          </div>
          <div class="flex flex-wrap items-center gap-6">
            <BaseCheckbox
              id="messaging-open-reports"
              v-model="model.withOpenReports"
              :label="t('admin.messaging.filters.withOpenReports')"
            />
            <BaseCheckbox
              id="messaging-blocked"
              v-model="model.blocked"
              :label="t('admin.messaging.filters.blocked')"
            />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <BaseLinkButton
              variant="secondary"
              size="sm"
              :href="urlFor('admin.messaging.reports', { locale })"
            >
              {{ t('admin.messaging.reportsQueue') }}
            </BaseLinkButton>
            <div class="flex gap-3">
              <BaseButton variant="secondary" size="sm" @click="reset">
                {{ t('admin.trade.filters.reset') }}
              </BaseButton>
              <BaseButton type="submit" size="sm">{{ t('admin.trade.filters.apply') }}</BaseButton>
            </div>
          </div>
        </form>
      </BaseCard>
    </template>

    <template #head>
      <tr>
        <th scope="col">{{ t('admin.messaging.columns.conversation') }}</th>
        <th scope="col">{{ t('admin.trade.columns.buyer') }}</th>
        <th scope="col">{{ t('admin.trade.columns.supplier') }}</th>
        <th scope="col" class="text-right">{{ t('admin.messaging.columns.messages') }}</th>
        <th scope="col" class="text-right">{{ t('admin.messaging.columns.reports') }}</th>
        <th scope="col">{{ t('admin.messaging.columns.lastMessage') }}</th>
        <th scope="col">{{ t('admin.trade.columns.status') }}</th>
      </tr>
    </template>

    <tr v-for="row in conversations.data" :key="row.id">
      <td class="font-semibold text-text-primary">
        <Link :href="showUrl(row)">
          {{ row.subject ?? t('admin.messaging.untitled', { id: row.id }) }}
        </Link>
      </td>
      <td>{{ row.buyer.name }}</td>
      <td>{{ row.supplier.name }}</td>
      <td class="text-tabular text-right">{{ row.messagesCount }}</td>
      <td class="text-tabular text-right">
        <BaseBadge v-if="row.openReportsCount" tone="warning">{{ row.openReportsCount }}</BaseBadge>
        <span v-else>0</span>
      </td>
      <td>{{ dateTime(row.lastMessageAt) }}</td>
      <td>
        <BaseBadge v-if="row.blockedAt" tone="danger">{{ t('admin.messaging.blocked') }}</BaseBadge>
      </td>
    </tr>
  </TradeList>
</template>
