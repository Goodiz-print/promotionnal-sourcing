<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminAiDailyVolume } from '#shared/types/admin_ai'

/**
 * Volume quotidien d'appels. Le graphique est un tableau : les barres sont
 * décoratives (`aria-hidden`), les chiffres restent lisibles par tous.
 */
const props = defineProps<{ rows: AdminAiDailyVolume[] }>()

const { t, locale } = useI18n()

const peak = computed(() => Math.max(1, ...props.rows.map((row) => row.calls)))

const width = (value: number) => `${Math.round((value / peak.value) * 100)}%`
const formatDay = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(locale.value)
</script>

<template>
  <BaseSection :title="t('admin.ai.volume.title')" :description="t('admin.ai.volume.hint')" flush>
    <BaseTable :caption="t('admin.ai.volume.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.ai.columns.day') }}</th>
          <th scope="col">{{ t('admin.ai.columns.calls') }}</th>
          <th scope="col" class="text-right">{{ t('admin.ai.columns.failed') }}</th>
          <th scope="col" class="text-right">{{ t('admin.ai.columns.tokens') }}</th>
        </tr>
      </template>

      <tr v-for="row in rows" :key="row.day">
        <td class="text-tabular whitespace-nowrap">{{ formatDay(row.day) }}</td>
        <td class="w-full">
          <div class="flex items-center gap-3">
            <span
              class="h-2 rounded-full bg-indigo-600"
              :style="{ width: width(row.calls) }"
              aria-hidden="true"
            />
            <span class="text-tabular">{{ row.calls }}</span>
          </div>
        </td>
        <td class="text-tabular text-right text-text-secondary">{{ row.failed }}</td>
        <td class="text-tabular text-right text-text-secondary">
          {{ row.tokens.toLocaleString(locale) }}
        </td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
