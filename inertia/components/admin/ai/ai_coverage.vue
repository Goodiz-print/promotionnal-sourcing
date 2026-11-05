<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import { CONTENT_LOCALE_LABELS, type ContentLocale } from '#shared/types/i18n'
import type { AdminAiCoverageRow } from '#shared/types/admin_ai'

/** Couverture de traduction par langue de contenu (barre décorative + chiffres). */
defineProps<{ rows: AdminAiCoverageRow[] }>()

const { t } = useI18n()

const percent = (row: AdminAiCoverageRow) =>
  row.total === 0 ? 0 : Math.min(100, Math.round(((row.auto + row.manual) / row.total) * 100))
</script>

<template>
  <BaseSection
    :title="t('admin.ai.coverage.title')"
    :description="t('admin.ai.coverage.hint')"
    flush
  >
    <BaseTable :caption="t('admin.ai.coverage.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.ai.columns.language') }}</th>
          <th scope="col">{{ t('admin.ai.columns.coverage') }}</th>
          <th scope="col" class="text-right">{{ t('admin.ai.columns.auto') }}</th>
          <th scope="col" class="text-right">{{ t('admin.ai.columns.manual') }}</th>
        </tr>
      </template>

      <tr v-for="row in rows" :key="row.locale">
        <td class="whitespace-nowrap font-semibold text-text-primary">
          {{ CONTENT_LOCALE_LABELS[row.locale as ContentLocale] ?? row.locale }}
        </td>
        <td class="w-full">
          <div class="flex items-center gap-3">
            <span
              class="h-2 rounded-full bg-indigo-600"
              :style="{ width: `${percent(row)}%` }"
              aria-hidden="true"
            />
            <span class="text-tabular">{{ percent(row) }} %</span>
          </div>
        </td>
        <td class="text-tabular text-right text-text-secondary">{{ row.auto }}</td>
        <td class="text-tabular text-right text-text-secondary">{{ row.manual }}</td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
