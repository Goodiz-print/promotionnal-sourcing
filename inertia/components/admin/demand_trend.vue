<script setup lang="ts">
import { computed } from 'vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import { useI18n } from '~/i18n'
import type { DemandTrendRow } from '#shared/types/admin_demand'

/**
 * Évolution quotidienne des recherches. Le graphique est un tableau : les barres
 * sont décoratives (`aria-hidden`), les chiffres restent lisibles par tous.
 */
const props = defineProps<{ rows: DemandTrendRow[] }>()

const { t, locale } = useI18n()

const peak = computed(() => Math.max(1, ...props.rows.map((row) => row.searches)))

function width(value: number): string {
  return `${Math.round((value / peak.value) * 100)}%`
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(locale.value)
}
</script>

<template>
  <BaseSection
    :title="t('admin.demand.trend.title')"
    :description="t('admin.demand.trend.hint')"
    flush
  >
    <BaseEmptyState v-if="rows.length === 0" :title="t('admin.demand.empty')" />

    <BaseTable v-else :caption="t('admin.demand.trend.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.demand.columns.day') }}</th>
          <th scope="col">{{ t('admin.demand.columns.searches') }}</th>
          <th scope="col" class="text-right">{{ t('admin.demand.columns.zeroResults') }}</th>
        </tr>
      </template>

      <tr v-for="row in rows" :key="row.day">
        <td class="text-tabular whitespace-nowrap">{{ formatDay(row.day) }}</td>
        <td class="w-full">
          <div class="flex items-center gap-3">
            <span
              class="h-2 rounded-full bg-indigo-600"
              :style="{ width: width(row.searches) }"
              aria-hidden="true"
            />
            <span class="text-tabular">{{ row.searches }}</span>
          </div>
        </td>
        <td class="text-tabular text-right text-text-secondary">{{ row.zeroResultSearches }}</td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
