<script setup lang="ts">
import { SearchX } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { SearchInsightsQueryRow } from '#shared/types/search_insights'

/** Classement de requêtes (top requêtes, ou requêtes sans résultat avec le détail des échecs). */
defineProps<{
  title: string
  description: string
  rows: SearchInsightsQueryRow[]
  /** Affiche la colonne « sans résultat » (utile pour le top général). */
  showZeroCount?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <BaseSection :title="title" :description="description" flush>
    <BaseEmptyState
      v-if="rows.length === 0"
      :title="t('admin.search.noRows')"
      :icon="SearchX"
      compact
    />
    <BaseTable v-else :caption="title" bare>
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.search.columns.query') }}</th>
          <th scope="col" class="text-right">{{ t('admin.search.columns.searches') }}</th>
          <th v-if="showZeroCount" scope="col" class="text-right">
            {{ t('admin.search.columns.zeroCount') }}
          </th>
          <th scope="col" class="text-right">{{ t('admin.search.columns.avgResults') }}</th>
        </tr>
      </template>
      <tr v-for="row in rows" :key="row.query">
        <td class="font-semibold text-text-primary">{{ row.query }}</td>
        <td class="text-tabular text-right">{{ row.count }}</td>
        <td v-if="showZeroCount" class="text-tabular text-right">{{ row.zeroCount }}</td>
        <td class="text-tabular text-right">{{ row.avgResults }}</td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
