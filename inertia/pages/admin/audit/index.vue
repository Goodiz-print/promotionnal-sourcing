<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { ArrowRight, ScrollText } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import AuditFilters from '~/components/admin/audit_filters.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import BaseTable from '~/components/base/base_table.vue'
import type {
  AdminAuditChanges,
  AdminAuditFilters,
  AdminAuditLogItem,
} from '#shared/types/admin_audit'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<{
  entries: Paginated<AdminAuditLogItem>
  filters: AdminAuditFilters
}>()

const { t, locale } = useI18n()

let current = { ...props.filters }

function visit(filters: AdminAuditFilters, page = 1) {
  current = filters
  router.get(
    urlFor('admin.audit.index', { locale: locale.value }),
    {
      action: filters.action || undefined,
      targetType: filters.targetType || undefined,
      actor: filters.actor || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page,
    },
    { preserveState: true, preserveScroll: true, only: ['entries', 'filters'] }
  )
}

interface ChangeLine {
  key: string
  before?: string | number | boolean | null
  after?: string | number | boolean | null
}

/** Une ligne par champ touché : valeur avant, valeur après, ou l'une des deux (création, suppression). */
function describeChanges(changes: AdminAuditChanges | null): ChangeLine[] {
  if (!changes) return []
  const keys = new Set([...Object.keys(changes.before ?? {}), ...Object.keys(changes.after ?? {})])
  return [...keys].map((key) => ({
    key,
    before: changes.before?.[key],
    after: changes.after?.[key],
  }))
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(locale.value)
}
</script>

<template>
  <Head :title="t('admin.audit.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('admin.audit.title')" :description="t('admin.audit.subtitle')" />

    <AuditFilters :filters="filters" @change="visit" />

    <div class="flex flex-col gap-4">
      <p class="text-tabular text-body-sm text-text-secondary">
        {{ t('admin.audit.resultsCount', { count: entries.meta.total }) }}
      </p>

      <BaseEmptyState
        v-if="entries.data.length === 0"
        :title="t('admin.audit.empty')"
        :description="t('admin.audit.emptyDescription')"
        :icon="ScrollText"
      />

      <BaseTable v-else :caption="t('admin.audit.title')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.audit.columns.date') }}</th>
            <th scope="col">{{ t('admin.audit.columns.actor') }}</th>
            <th scope="col">{{ t('admin.audit.columns.action') }}</th>
            <th scope="col">{{ t('admin.audit.columns.target') }}</th>
            <th scope="col">{{ t('admin.audit.columns.changes') }}</th>
          </tr>
        </template>

        <tr v-for="entry in entries.data" :key="entry.id">
          <td class="text-tabular whitespace-nowrap">{{ formatDate(entry.createdAt) }}</td>
          <td class="text-text-secondary">
            <span v-if="entry.actorEmail">{{ entry.actorEmail }}</span>
            <BaseBadge v-else tone="neutral">{{ t('admin.audit.system') }}</BaseBadge>
          </td>
          <td class="font-semibold text-text-primary">
            {{ t(`admin.audit.actions.${entry.action}`) }}
          </td>
          <td class="whitespace-nowrap text-text-secondary">
            <template v-if="entry.targetType">
              {{ t(`admin.audit.targets.${entry.targetType}`) }} #{{ entry.targetId }}
            </template>
          </td>
          <td>
            <ul class="flex flex-col gap-0.5 text-caption text-text-secondary">
              <li
                v-for="line in describeChanges(entry.changes)"
                :key="line.key"
                class="flex flex-wrap items-center gap-1"
              >
                <span class="font-semibold">{{ line.key }}:</span>
                <span v-if="line.before !== undefined">{{ line.before }}</span>
                <template v-if="line.before !== undefined && line.after !== undefined">
                  <ArrowRight :size="12" aria-hidden="true" />
                  <span class="sr-only">{{ t('admin.audit.becomes') }}</span>
                </template>
                <span v-if="line.after !== undefined">{{ line.after }}</span>
              </li>
              <li v-if="entry.changes?.source === 'cli'">
                <BaseBadge tone="info">{{ t('admin.audit.viaCli') }}</BaseBadge>
              </li>
            </ul>
          </td>
        </tr>
      </BaseTable>

      <BasePagination
        :meta="entries.meta"
        :previous-label="t('admin.pagination.previous')"
        :next-label="t('admin.pagination.next')"
        @change="(page) => visit(current, page)"
      />
    </div>
  </div>
</template>
