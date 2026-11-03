<script setup lang="ts">
import { computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Download, Search, SearchX, Sparkles, TrendingUp } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import DemandFilters from '~/components/admin/demand_filters.vue'
import DemandRanking from '~/components/admin/demand_ranking.vue'
import type { RankingRow } from '~/components/admin/types'
import DemandTrend from '~/components/admin/demand_trend.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseStat from '~/components/base/base_stat.vue'
import { BUTTON_BASE_CLASSES, BUTTON_SIZE_CLASSES, BUTTON_VARIANT_CLASSES } from '~/types/ui'
import type { AdminDemandFilters, AdminDemandReport } from '#shared/types/admin_demand'

const props = defineProps<{ report: AdminDemandReport; filters: AdminDemandFilters }>()

const { t, locale } = useI18n()

function params(filters: AdminDemandFilters) {
  return {
    from: filters.from || undefined,
    to: filters.to || undefined,
    source: filters.source || undefined,
    locale: filters.locale || undefined,
    organizationType: filters.organizationType || undefined,
  }
}

function visit(filters: AdminDemandFilters) {
  router.get(urlFor('admin.demand.index', { locale: locale.value }), params(filters), {
    preserveState: true,
    preserveScroll: true,
    only: ['report', 'filters'],
  })
}

/** Le CSV reprend les filtres affichés ; c'est un téléchargement, pas une visite Inertia. */
const exportHref = computed(() => {
  const query = new URLSearchParams(
    Object.entries(params(props.filters)).filter(([, value]) => value) as [string, string][]
  )
  return `${urlFor('admin.demand.export', { locale: locale.value })}?${query.toString()}`
})

const exportClasses = [
  BUTTON_BASE_CLASSES,
  BUTTON_VARIANT_CLASSES.secondary,
  BUTTON_SIZE_CLASSES.md,
]

const percent = (value: number) =>
  new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }).format(value)

function queryRows(rows: AdminDemandReport['topQueries']): RankingRow[] {
  return rows.map((row) => ({
    key: row.query,
    label: row.query,
    value: row.searches,
    extra: row.averageResults,
  }))
}

function zeroRows(rows: AdminDemandReport['zeroResultQueries']): RankingRow[] {
  return rows.map((row) => ({
    key: row.query,
    label: row.query,
    value: row.zeroResultSearches,
    extra: row.searches,
  }))
}

function targetRows(rows: AdminDemandReport['viewedProducts']): RankingRow[] {
  return rows.map((row) => ({ key: row.targetId, label: row.name, value: row.count }))
}

const modeRows = computed<RankingRow[]>(() =>
  props.report.modes.map((row) => ({
    key: row.mode,
    label: t(`admin.demand.modes.${row.mode}`),
    value: row.searches,
  }))
)

const filterRows = computed<RankingRow[]>(() =>
  props.report.filters.map((row) => ({ key: row.filter, label: row.filter, value: row.searches }))
)

const categoryRows = computed<RankingRow[]>(() =>
  props.report.categories.map((row) => ({
    key: row.categoryId,
    label: row.name,
    value: row.searches,
  }))
)
</script>

<template>
  <Head :title="t('admin.demand.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('admin.demand.title')" :description="t('admin.demand.subtitle')">
      <template #actions>
        <a :href="exportHref" download :class="exportClasses">
          <Download :size="16" aria-hidden="true" />
          {{ t('admin.demand.export') }}
        </a>
      </template>
    </BasePageHeader>

    <DemandFilters :filters="filters" @change="visit" />

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <BaseStat
        :label="t('admin.demand.summary.searches')"
        :value="report.summary.searches"
        :icon="Search"
      />
      <BaseStat
        :label="t('admin.demand.summary.zeroResults')"
        :value="report.summary.zeroResultSearches"
        :icon="SearchX"
      />
      <BaseStat
        :label="t('admin.demand.summary.zeroResultRate')"
        :value="percent(report.summary.zeroResultRate)"
        :icon="TrendingUp"
      />
      <BaseStat
        :label="t('admin.demand.summary.semanticRate')"
        :value="percent(report.summary.semanticRate)"
        :icon="Sparkles"
      />
    </div>

    <DemandTrend :rows="report.trend" />

    <div class="grid gap-8 lg:grid-cols-2">
      <DemandRanking
        :title="t('admin.demand.topQueries.title')"
        :label-header="t('admin.demand.columns.query')"
        :value-header="t('admin.demand.columns.searches')"
        :extra-header="t('admin.demand.columns.averageResults')"
        :rows="queryRows(report.topQueries)"
      />
      <DemandRanking
        :title="t('admin.demand.zeroResults.title')"
        :description="t('admin.demand.zeroResults.hint')"
        :label-header="t('admin.demand.columns.query')"
        :value-header="t('admin.demand.columns.zeroResults')"
        :extra-header="t('admin.demand.columns.searches')"
        :rows="zeroRows(report.zeroResultQueries)"
      />
      <DemandRanking
        :title="t('admin.demand.categories.title')"
        :label-header="t('admin.demand.columns.category')"
        :value-header="t('admin.demand.columns.searches')"
        :rows="categoryRows"
      />
      <DemandRanking
        :title="t('admin.demand.filtersUsed.title')"
        :label-header="t('admin.demand.columns.filter')"
        :value-header="t('admin.demand.columns.searches')"
        :rows="filterRows"
      />
      <DemandRanking
        :title="t('admin.demand.modesTitle')"
        :label-header="t('admin.demand.columns.mode')"
        :value-header="t('admin.demand.columns.searches')"
        :rows="modeRows"
      />
      <DemandRanking
        :title="t('admin.demand.viewedProducts.title')"
        :label-header="t('admin.demand.columns.product')"
        :value-header="t('admin.demand.columns.views')"
        :rows="targetRows(report.viewedProducts)"
      />
      <DemandRanking
        :title="t('admin.demand.viewedSuppliers.title')"
        :label-header="t('admin.demand.columns.supplier')"
        :value-header="t('admin.demand.columns.views')"
        :rows="targetRows(report.viewedSuppliers)"
      />
      <DemandRanking
        :title="t('admin.demand.rfqProducts.title')"
        :description="t('admin.demand.rfqProducts.hint')"
        :label-header="t('admin.demand.columns.product')"
        :value-header="t('admin.demand.columns.rfqAdds')"
        :rows="targetRows(report.rfqProducts)"
      />
    </div>
  </div>
</template>
