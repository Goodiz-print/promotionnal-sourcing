<script setup lang="ts">
import { SearchX } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { RankingRow } from '~/components/admin/types'

/**
 * Classement générique : une colonne de libellé et une ou deux colonnes numériques
 * (`count`, `extra`). Sert aux catégories, filtres, produits et fournisseurs.
 */
defineProps<{
  title: string
  description: string
  labelHeader: string
  countHeader: string
  extraHeader?: string
  rows: RankingRow[]
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
          <th scope="col">{{ labelHeader }}</th>
          <th scope="col" class="text-right">{{ countHeader }}</th>
          <th v-if="extraHeader" scope="col" class="text-right">{{ extraHeader }}</th>
        </tr>
      </template>
      <tr v-for="row in rows" :key="row.id">
        <td class="font-semibold text-text-primary">{{ row.label }}</td>
        <td class="text-tabular text-right">{{ row.count }}</td>
        <td v-if="extraHeader" class="text-tabular text-right">{{ row.extra ?? 0 }}</td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
