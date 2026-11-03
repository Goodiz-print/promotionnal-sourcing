<script setup lang="ts">
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import { useI18n } from '~/i18n'
import type { RankingRow } from '~/components/admin/types'

/**
 * Classement de l'écran « Ce que cherchent les clients » : un libellé, un
 * compteur et, au besoin, une seconde colonne. Vide, il affiche un état vide.
 */
defineProps<{
  title: string
  description?: string
  labelHeader: string
  valueHeader: string
  extraHeader?: string
  rows: RankingRow[]
}>()

const { t } = useI18n()
</script>

<template>
  <BaseSection :title="title" :description="description" flush>
    <BaseEmptyState v-if="rows.length === 0" :title="t('admin.demand.empty')" />

    <BaseTable v-else :caption="title">
      <template #head>
        <tr>
          <th scope="col">{{ labelHeader }}</th>
          <th scope="col" class="text-right">{{ valueHeader }}</th>
          <th v-if="extraHeader" scope="col" class="text-right">{{ extraHeader }}</th>
        </tr>
      </template>

      <tr v-for="row in rows" :key="row.key">
        <td class="font-semibold text-text-primary">{{ row.label }}</td>
        <td class="text-tabular text-right">{{ row.value }}</td>
        <td v-if="extraHeader" class="text-tabular text-right text-text-secondary">
          {{ row.extra }}
        </td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
