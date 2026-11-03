<script setup lang="ts">
import { computed } from 'vue'
import { Ban, Search } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { variationPercent } from '~/composables/use_search_insights'
import BaseCard from '~/components/base/base_card.vue'
import BaseStat from '~/components/base/base_stat.vue'
import { SEARCH_EVENT_MODES } from '#shared/types/search_event'
import type { SearchInsightsSummary } from '#shared/types/search_insights'

/** Cartes de synthèse : volume (et variation), recherches sans résultat (et taux), modes. */
const props = defineProps<{ summary: SearchInsightsSummary }>()

const { t, locale } = useI18n()

const rate = computed(() =>
  new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }).format(
    props.summary.zeroRate
  )
)

const variationHint = computed(() => {
  const percent = variationPercent(props.summary.total, props.summary.previousTotal)
  if (percent === null) return t('admin.search.summary.noPrevious')
  return t('admin.search.summary.variation', {
    percent: `${percent > 0 ? '+' : ''}${percent}`,
  })
})
</script>

<template>
  <div class="grid gap-4 md:grid-cols-3">
    <BaseStat
      :label="t('admin.search.summary.total')"
      :value="summary.total"
      :hint="variationHint"
      :icon="Search"
    />
    <BaseStat
      :label="t('admin.search.summary.zeroResults')"
      :value="summary.zeroResults"
      :hint="t('admin.search.summary.zeroRate', { rate })"
      :icon="Ban"
    />
    <BaseCard padding="md">
      <p class="text-caption font-semibold text-text-muted">
        {{ t('admin.search.summary.modes') }}
      </p>
      <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
        <template v-for="mode in SEARCH_EVENT_MODES" :key="mode">
          <dt class="text-caption text-text-secondary">{{ t(`admin.search.modes.${mode}`) }}</dt>
          <dd class="text-tabular text-right text-body-sm font-semibold text-text-primary">
            {{ summary.byMode[mode] }}
          </dd>
        </template>
      </dl>
    </BaseCard>
  </div>
</template>
