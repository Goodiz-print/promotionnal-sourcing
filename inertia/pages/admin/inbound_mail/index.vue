<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Inbox } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import InboundMailOverview from '~/components/admin/inbound_mail/inbound_mail_overview.vue'
import InboundMailStatusBadge from '~/components/admin/inbound_mail/inbound_mail_status_badge.vue'
import TradeList from '~/components/admin/trade_list.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseSelect from '~/components/base/base_select.vue'
import type {
  AdminInboundMailFilters,
  AdminInboundMailOverview,
  AdminInboundMailRow,
} from '#shared/types/admin_inbound_mail'
import type { InboundMailRejection, InboundMailStatus } from '#shared/types/inbound_mail'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<{
  overview: AdminInboundMailOverview
  mails: Paginated<AdminInboundMailRow>
  filters: AdminInboundMailFilters
  statuses: InboundMailStatus[]
  rejections: InboundMailRejection[]
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
  if (model.status) query.status = model.status
  if (model.rejection) query.rejection = model.rejection
  router.get(urlFor('admin.inbound_mail.index', { locale: locale.value }), query, {
    preserveState: true,
    preserveScroll: true,
    only: ['overview', 'mails', 'filters'],
  })
}

function reset() {
  Object.assign(model, { status: null, rejection: null })
  visit()
}
</script>

<template>
  <Head :title="t('admin.inboundMail.title')" />

  <TradeList
    :title="t('admin.inboundMail.title')"
    :description="t('admin.inboundMail.subtitle')"
    :count-label="t('admin.inboundMail.resultsCount', { count: mails.meta.total })"
    :empty-title="t('admin.inboundMail.empty')"
    :empty-description="t('admin.inboundMail.emptyDescription')"
    :icon="Inbox"
    :meta="mails.meta"
    @page="visit"
  >
    <template #filters>
      <InboundMailOverview :overview="overview" />

      <BaseCard padding="md">
        <form class="flex flex-col gap-4" @submit.prevent="visit()">
          <div class="grid gap-4 sm:grid-cols-2">
            <BaseSelect
              id="inbound-mail-status"
              v-model="model.status"
              :label="t('admin.inboundMail.filters.status')"
            >
              <option :value="null">{{ t('admin.inboundMail.filters.all') }}</option>
              <option v-for="status in statuses" :key="status" :value="status">
                {{ t(`admin.inboundMail.statuses.${status}`) }}
              </option>
            </BaseSelect>
            <BaseSelect
              id="inbound-mail-rejection"
              v-model="model.rejection"
              :label="t('admin.inboundMail.filters.rejection')"
            >
              <option :value="null">{{ t('admin.inboundMail.filters.all') }}</option>
              <option v-for="rejection in rejections" :key="rejection" :value="rejection">
                {{ t(`admin.inboundMail.rejections.${rejection}`) }}
              </option>
            </BaseSelect>
          </div>
          <div class="flex justify-end gap-3">
            <BaseButton variant="secondary" size="sm" @click="reset">
              {{ t('admin.trade.filters.reset') }}
            </BaseButton>
            <BaseButton type="submit" size="sm">{{ t('admin.trade.filters.apply') }}</BaseButton>
          </div>
        </form>
      </BaseCard>
    </template>

    <template #head>
      <tr>
        <th scope="col">{{ t('admin.inboundMail.columns.sender') }}</th>
        <th scope="col">{{ t('admin.inboundMail.columns.subject') }}</th>
        <th scope="col">{{ t('admin.inboundMail.columns.target') }}</th>
        <th scope="col">{{ t('admin.inboundMail.columns.status') }}</th>
        <th scope="col">{{ t('admin.inboundMail.columns.receivedAt') }}</th>
      </tr>
    </template>

    <tr v-for="row in mails.data" :key="row.id">
      <td class="font-semibold text-text-primary">
        <Link :href="urlFor('admin.inbound_mail.show', { locale, id: row.id })">
          {{ row.senderName ?? row.senderAddress }}
        </Link>
        <p v-if="row.senderName" class="text-caption text-text-secondary">
          {{ row.senderAddress }}
        </p>
      </td>
      <td class="max-w-xs truncate">{{ row.subject ?? '—' }}</td>
      <td>
        <template v-if="row.target">
          {{ row.target.supplierName }}
          <p class="text-caption text-text-secondary">{{ row.target.rfqTitle }}</p>
        </template>
        <span v-else class="text-text-secondary">{{ t('admin.inboundMail.unattached') }}</span>
      </td>
      <td>
        <InboundMailStatusBadge :status="row.status" :rejection-reason="row.rejectionReason" />
      </td>
      <td>{{ dateTime(row.receivedAt) }}</td>
    </tr>
  </TradeList>
</template>
