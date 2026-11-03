<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { ShieldCheck } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useAdminTabs } from '~/composables/use_admin_tabs'
import ModerationFilters from '~/components/admin/moderation_filters.vue'
import ModerationStatusBadge from '~/components/admin/moderation_status_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import BaseTable from '~/components/base/base_table.vue'
import BaseTabs from '~/components/base/base_tabs.vue'
import type { AdminModerationFilters, AdminModerationItem } from '#shared/types/admin_moderation'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<{
  queue: Paginated<AdminModerationItem>
  filters: AdminModerationFilters
}>()

const { t, locale } = useI18n()
const { items: adminTabs, label: adminTabsLabel } = useAdminTabs()

let current = { ...props.filters }

function visit(filters: AdminModerationFilters, page = 1) {
  current = filters
  router.get(
    urlFor('admin.moderation.index', { locale: locale.value }),
    {
      type: filters.type || undefined,
      status: filters.status,
      minAgeDays: filters.minAgeDays || undefined,
      page,
    },
    { preserveState: true, preserveScroll: true, only: ['queue', 'filters'] }
  )
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(locale.value)
}

function showUrl(item: AdminModerationItem): string {
  return urlFor('admin.moderation.show', {
    locale: locale.value,
    type: item.targetType,
    id: item.targetId,
  })
}
</script>

<template>
  <Head :title="t('admin.moderation.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('admin.moderation.title')"
      :description="t('admin.moderation.subtitle')"
    />

    <BaseTabs :items="adminTabs" :label="adminTabsLabel" />

    <ModerationFilters :filters="filters" @change="visit" />

    <div class="flex flex-col gap-4">
      <p class="text-tabular text-body-sm text-text-secondary">
        {{ t('admin.moderation.resultsCount', { count: queue.meta.total }) }}
      </p>

      <BaseEmptyState
        v-if="queue.data.length === 0"
        :title="t('admin.moderation.empty')"
        :description="t('admin.moderation.emptyDescription')"
        :icon="ShieldCheck"
      />

      <BaseTable v-else :caption="t('admin.moderation.title')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.moderation.columns.item') }}</th>
            <th scope="col">{{ t('admin.moderation.columns.type') }}</th>
            <th scope="col">{{ t('admin.moderation.columns.context') }}</th>
            <th scope="col">{{ t('admin.moderation.columns.submitted') }}</th>
            <th scope="col">{{ t('admin.moderation.columns.status') }}</th>
            <th scope="col">
              <span class="sr-only">{{ t('admin.moderation.review') }}</span>
            </th>
          </tr>
        </template>

        <tr v-for="item in queue.data" :key="`${item.targetType}-${item.targetId}`">
          <td class="font-semibold text-text-primary">{{ item.label }}</td>
          <td class="text-text-secondary">{{ t(`admin.moderation.types.${item.targetType}`) }}</td>
          <td class="text-text-secondary">{{ item.subtitle }}</td>
          <td class="text-tabular whitespace-nowrap">{{ formatDate(item.submittedAt) }}</td>
          <td><ModerationStatusBadge :status="item.status" /></td>
          <td class="text-right">
            <BaseLinkButton :href="showUrl(item)" variant="secondary" size="sm">
              {{ t('admin.moderation.review') }}
            </BaseLinkButton>
          </td>
        </tr>
      </BaseTable>

      <BasePagination
        :meta="queue.meta"
        :previous-label="t('admin.pagination.previous')"
        :next-label="t('admin.pagination.next')"
        @change="(page) => visit(current, page)"
      />
    </div>
  </div>
</template>
