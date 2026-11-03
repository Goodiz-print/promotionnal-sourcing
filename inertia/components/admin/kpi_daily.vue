<script setup lang="ts">
import { computed } from 'vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import { useI18n } from '~/i18n'
import type { KpiDailyRow } from '#shared/types/admin_kpi'

/**
 * Activité quotidienne de la période. Le graphique est un tableau : les barres
 * (activité totale du jour) sont décoratives (`aria-hidden`), les chiffres restent
 * lisibles par tous.
 */
const props = defineProps<{ rows: KpiDailyRow[] }>()

const { t, locale } = useI18n()

const total = (row: KpiDailyRow) =>
  row.organizations + row.users + row.rfqs + row.quotes + row.orders

const peak = computed(() => Math.max(1, ...props.rows.map(total)))

const width = (row: KpiDailyRow) => `${Math.round((total(row) / peak.value) * 100)}%`

const formatDay = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(locale.value)
</script>

<template>
  <BaseSection
    :title="t('admin.dashboard.kpi.groups.daily')"
    :description="t('admin.dashboard.kpi.dailyHint')"
    flush
  >
    <BaseTable :caption="t('admin.dashboard.kpi.groups.daily')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.demand.columns.day') }}</th>
          <th scope="col">{{ t('admin.dashboard.kpi.daily.activity') }}</th>
          <th scope="col" class="text-right">{{ t('admin.dashboard.kpi.daily.organizations') }}</th>
          <th scope="col" class="text-right">{{ t('admin.dashboard.kpi.daily.users') }}</th>
          <th scope="col" class="text-right">{{ t('admin.dashboard.kpi.daily.rfqs') }}</th>
          <th scope="col" class="text-right">{{ t('admin.dashboard.kpi.daily.quotes') }}</th>
          <th scope="col" class="text-right">{{ t('admin.dashboard.kpi.daily.orders') }}</th>
        </tr>
      </template>

      <tr v-for="row in rows" :key="row.day">
        <td class="text-tabular whitespace-nowrap">{{ formatDay(row.day) }}</td>
        <td class="w-full min-w-24">
          <span
            class="block h-2 rounded-full bg-indigo-600"
            :style="{ width: width(row) }"
            aria-hidden="true"
          />
        </td>
        <td class="text-tabular text-right">{{ row.organizations }}</td>
        <td class="text-tabular text-right">{{ row.users }}</td>
        <td class="text-tabular text-right">{{ row.rfqs }}</td>
        <td class="text-tabular text-right">{{ row.quotes }}</td>
        <td class="text-tabular text-right">{{ row.orders }}</td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
