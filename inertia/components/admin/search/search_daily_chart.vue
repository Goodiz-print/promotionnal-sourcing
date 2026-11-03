<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { SearchInsightsDayPoint } from '#shared/types/search_insights'

/**
 * Barres quotidiennes (SVG inline, sans bibliothèque) : total par jour, dont la
 * part sans résultat en teinte d'alerte. Le graphique est une image nommée
 * (`role="img"`) ; un tableau réservé aux lecteurs d'écran en donne les valeurs.
 */
const props = defineProps<{ daily: SearchInsightsDayPoint[] }>()

const { t } = useI18n()

const WIDTH = 600
const HEIGHT = 160
const GAP = 2

const max = computed(() => Math.max(1, ...props.daily.map((day) => day.total)))
const barWidth = computed(() => Math.max(1, WIDTH / Math.max(1, props.daily.length) - GAP))

const bars = computed(() =>
  props.daily.map((day, index) => {
    const total = (day.total / max.value) * HEIGHT
    const zero = (day.zeroResults / max.value) * HEIGHT
    return {
      date: day.date,
      x: index * (barWidth.value + GAP),
      totalHeight: total,
      totalY: HEIGHT - total,
      zeroHeight: zero,
      zeroY: HEIGHT - zero,
      label: t('admin.search.chart.point', {
        date: day.date,
        total: day.total,
        zero: day.zeroResults,
      }),
    }
  })
)

const summaryLabel = computed(() =>
  t('admin.search.chart.label', {
    from: props.daily[0]?.date ?? '',
    to: props.daily.at(-1)?.date ?? '',
  })
)
</script>

<template>
  <BaseSection
    :title="t('admin.search.chart.title')"
    :description="t('admin.search.chart.description')"
  >
    <svg
      role="img"
      :aria-label="summaryLabel"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      preserveAspectRatio="none"
      class="h-40 w-full"
    >
      <title>{{ summaryLabel }}</title>
      <g v-for="bar in bars" :key="bar.date">
        <title>{{ bar.label }}</title>
        <rect
          :x="bar.x"
          :y="bar.totalY"
          :width="barWidth"
          :height="bar.totalHeight"
          class="fill-indigo-500"
        />
        <rect
          :x="bar.x"
          :y="bar.zeroY"
          :width="barWidth"
          :height="bar.zeroHeight"
          class="fill-warning"
        />
      </g>
    </svg>

    <ul class="mt-3 flex flex-wrap gap-4 text-caption text-text-secondary">
      <li class="flex items-center gap-1.5">
        <span class="size-2.5 rounded-xs bg-indigo-500" aria-hidden="true" />
        {{ t('admin.search.chart.total') }}
      </li>
      <li class="flex items-center gap-1.5">
        <span class="size-2.5 rounded-xs bg-warning" aria-hidden="true" />
        {{ t('admin.search.chart.zero') }}
      </li>
    </ul>

    <div class="sr-only">
      <BaseTable :caption="t('admin.search.chart.title')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.search.columns.date') }}</th>
            <th scope="col">{{ t('admin.search.chart.total') }}</th>
            <th scope="col">{{ t('admin.search.chart.zero') }}</th>
          </tr>
        </template>
        <tr v-for="day in daily" :key="day.date">
          <td>{{ day.date }}</td>
          <td>{{ day.total }}</td>
          <td>{{ day.zeroResults }}</td>
        </tr>
      </BaseTable>
    </div>
  </BaseSection>
</template>
