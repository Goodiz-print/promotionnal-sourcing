<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Mail } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useMailActions } from '~/composables/use_mail_actions'
import { useTradeFormat } from '~/composables/use_trade_format'
import MailRates from '~/components/admin/mail/mail_rates.vue'
import MailStatusBadge from '~/components/admin/mail/mail_status_badge.vue'
import TradeList from '~/components/admin/trade_list.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseSelect from '~/components/base/base_select.vue'
import type {
  AdminMailFilters,
  AdminMailOverview,
  AdminMailRow,
  AdminMailStatus,
} from '#shared/types/admin_ops'
import type { MailKind } from '#shared/types/mail'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<{
  overview: AdminMailOverview
  deliveries: Paginated<AdminMailRow>
  filters: AdminMailFilters
  statuses: AdminMailStatus[]
  kinds: MailKind[]
}>()

const { t, locale } = useI18n()
const { dateTime } = useTradeFormat()
const { retry } = useMailActions()

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
  if (model.kind) query.kind = model.kind
  router.get(urlFor('admin.mail.index', { locale: locale.value }), query, {
    preserveState: true,
    preserveScroll: true,
    only: ['overview', 'deliveries', 'filters'],
  })
}

function reset() {
  Object.assign(model, { status: null, kind: null })
  visit()
}
</script>

<template>
  <Head :title="t('admin.mail.title')" />

  <TradeList
    :title="t('admin.mail.title')"
    :description="t('admin.mail.subtitle')"
    :count-label="t('admin.mail.resultsCount', { count: deliveries.meta.total })"
    :empty-title="t('admin.mail.empty')"
    :empty-description="t('admin.mail.emptyDescription')"
    :icon="Mail"
    :meta="deliveries.meta"
    @page="visit"
  >
    <template #filters>
      <MailRates :overview="overview" />

      <BaseCard padding="md">
        <form class="flex flex-col gap-4" @submit.prevent="visit()">
          <div class="grid gap-4 sm:grid-cols-2">
            <BaseSelect
              id="mail-status"
              v-model="model.status"
              :label="t('admin.mail.filters.status')"
            >
              <option :value="null">{{ t('admin.mail.filters.all') }}</option>
              <option v-for="status in statuses" :key="status" :value="status">
                {{ t(`admin.mail.statuses.${status}`) }}
              </option>
            </BaseSelect>
            <BaseSelect id="mail-kind" v-model="model.kind" :label="t('admin.mail.filters.kind')">
              <option :value="null">{{ t('admin.mail.filters.all') }}</option>
              <option v-for="kind in kinds" :key="kind" :value="kind">
                {{ t(`admin.mail.kinds.${kind}`) }}
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
        <th scope="col">{{ t('admin.mail.columns.kind') }}</th>
        <th scope="col">{{ t('admin.mail.columns.recipient') }}</th>
        <th scope="col">{{ t('admin.mail.columns.status') }}</th>
        <th scope="col">{{ t('admin.mail.columns.attempts') }}</th>
        <th scope="col">{{ t('admin.mail.columns.date') }}</th>
        <th scope="col">{{ t('admin.mail.columns.error') }}</th>
        <th scope="col">
          <span class="sr-only">{{ t('admin.mail.columns.actions') }}</span>
        </th>
      </tr>
    </template>

    <tr v-for="row in deliveries.data" :key="row.id">
      <td class="font-semibold text-text-primary">
        <Link :href="urlFor('admin.mail.show', { locale, id: row.id })">
          {{ t(`admin.mail.kinds.${row.kind}`) }}
        </Link>
      </td>
      <td>{{ row.to }}</td>
      <td><MailStatusBadge :status="row.status" /></td>
      <td class="text-tabular">{{ row.attempts }}</td>
      <td>{{ dateTime(row.updatedAt) }}</td>
      <td class="max-w-xs truncate">{{ row.error ?? '—' }}</td>
      <td class="text-right">
        <BaseButton v-if="row.retryable" size="sm" @click="retry(row.id, { preserveScroll: true })">
          {{ t('admin.mail.actions.retry') }}
        </BaseButton>
      </td>
    </tr>
  </TradeList>
</template>
