<script setup lang="ts">
import { useI18n } from '~/i18n'
import { useTradeFormat } from '~/composables/use_trade_format'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import { formatFileSize } from '#shared/helpers/file_size'
import type { AdminStorageOverview } from '#shared/types/admin_ops'

/** Lignes `pending_*` plus anciennes que le seuil de reprise, les plus anciennes d'abord. */
defineProps<{ overview: AdminStorageOverview }>()

const { t } = useI18n()
const { dateTime } = useTradeFormat()
</script>

<template>
  <BaseSection
    :title="t('admin.storage.stale.title')"
    :description="t('admin.storage.stale.description', { hours: overview.thresholdHours })"
    flush
  >
    <p v-if="overview.stale.length === 0" class="px-6 py-4 text-body-sm text-text-secondary">
      {{ t('admin.storage.stale.empty') }}
    </p>
    <BaseTable v-else :caption="t('admin.storage.stale.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.storage.columns.key') }}</th>
          <th scope="col">{{ t('admin.storage.columns.status') }}</th>
          <th scope="col">{{ t('admin.storage.columns.size') }}</th>
          <th scope="col">{{ t('admin.storage.columns.createdAt') }}</th>
        </tr>
      </template>
      <tr v-for="row in overview.stale" :key="row.id">
        <td class="max-w-md truncate font-mono text-caption">{{ row.key }}</td>
        <td>{{ t(`admin.storage.statuses.${row.status}`) }}</td>
        <td class="text-tabular">{{ formatFileSize(row.size) }}</td>
        <td>{{ dateTime(row.createdAt) }}</td>
      </tr>
    </BaseTable>
    <p
      v-if="overview.staleCount > overview.stale.length"
      class="px-6 py-3 text-caption text-text-muted"
    >
      {{
        t('admin.storage.stale.truncated', {
          shown: overview.stale.length,
          total: overview.staleCount,
        })
      }}
    </p>
  </BaseSection>
</template>
