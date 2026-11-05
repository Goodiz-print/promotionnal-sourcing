<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Megaphone, Plus } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import TradeList from '~/components/admin/trade_list.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import { BUTTON_BASE_CLASSES, BUTTON_SIZE_CLASSES, BUTTON_VARIANT_CLASSES } from '~/types/ui'
import type { AdminAnnouncementRow, AnnouncementStatus } from '#shared/types/announcement'
import type { Paginated } from '#shared/types/pagination'

defineProps<{ announcements: Paginated<AdminAnnouncementRow> }>()

const { t, locale } = useI18n()
const { dateTime } = useTradeFormat()

const TONES: Record<AnnouncementStatus, 'neutral' | 'info' | 'success' | 'danger'> = {
  queued: 'neutral',
  sending: 'info',
  sent: 'success',
  failed: 'danger',
}

function visit(page = 1) {
  router.get(
    urlFor('admin.announcements.index', { locale: locale.value }),
    { page },
    { preserveScroll: true, only: ['announcements'] }
  )
}

function readRate(row: AdminAnnouncementRow): string {
  if (!row.sendInApp) return t('admin.announcements.noInApp')
  const percent = row.recipients > 0 ? Math.round((row.read / row.recipients) * 100) : 0
  return t('admin.announcements.readRate', { read: row.read, total: row.recipients, percent })
}

const newClasses = [BUTTON_BASE_CLASSES, BUTTON_VARIANT_CLASSES.primary, BUTTON_SIZE_CLASSES.md]
</script>

<template>
  <Head :title="t('admin.announcements.title')" />

  <TradeList
    :title="t('admin.announcements.title')"
    :description="t('admin.announcements.subtitle')"
    :count-label="t('admin.announcements.resultsCount', { count: announcements.meta.total })"
    :empty-title="t('admin.announcements.empty')"
    :empty-description="t('admin.announcements.emptyDescription')"
    :icon="Megaphone"
    :meta="announcements.meta"
    @page="visit"
  >
    <template #filters>
      <div class="flex justify-end">
        <Link :href="urlFor('admin.announcements.create', { locale })" :class="newClasses">
          <Plus :size="16" aria-hidden="true" />
          {{ t('admin.announcements.new') }}
        </Link>
      </div>
    </template>

    <template #head>
      <tr>
        <th scope="col">{{ t('admin.announcements.columns.title') }}</th>
        <th scope="col">{{ t('admin.announcements.columns.audience') }}</th>
        <th scope="col">{{ t('admin.announcements.columns.channels') }}</th>
        <th scope="col">{{ t('admin.announcements.columns.status') }}</th>
        <th scope="col">{{ t('admin.announcements.columns.recipients') }}</th>
        <th scope="col">{{ t('admin.announcements.columns.readRate') }}</th>
        <th scope="col">{{ t('admin.announcements.columns.createdBy') }}</th>
        <th scope="col">{{ t('admin.announcements.columns.date') }}</th>
      </tr>
    </template>

    <tr v-for="row in announcements.data" :key="row.id">
      <td class="font-semibold text-text-primary">{{ row.title }}</td>
      <td>
        {{ t(`admin.announcements.audiences.${row.audience}`) }}
        <Link
          v-if="row.organization"
          :href="urlFor('admin.organizations.show', { locale, id: row.organization.id })"
        >
          ({{ row.organization.name }})
        </Link>
      </td>
      <td>
        <span class="flex flex-wrap gap-1">
          <BaseBadge v-if="row.sendInApp" tone="neutral">
            {{ t('admin.announcements.channels.inApp') }}
          </BaseBadge>
          <BaseBadge v-if="row.sendEmail" tone="neutral">
            {{ t('admin.announcements.channels.email') }}
          </BaseBadge>
        </span>
      </td>
      <td>
        <BaseBadge :tone="TONES[row.status]">
          {{ t(`admin.announcements.statuses.${row.status}`) }}
        </BaseBadge>
      </td>
      <td class="text-tabular">{{ row.recipients }}</td>
      <td class="text-tabular">{{ readRate(row) }}</td>
      <td>{{ row.createdBy ?? '—' }}</td>
      <td>{{ dateTime(row.createdAt) }}</td>
    </tr>
  </TradeList>
</template>
