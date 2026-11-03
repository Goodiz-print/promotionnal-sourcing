<script setup lang="ts">
import { computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Download, SearchX } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useAdminTabs } from '~/composables/use_admin_tabs'
import { searchParams, withSearchParams } from '~/composables/use_search_insights'
import SearchDailyChart from '~/components/admin/search/search_daily_chart.vue'
import SearchFilters from '~/components/admin/search/search_filters.vue'
import SearchQueriesTable from '~/components/admin/search/search_queries_table.vue'
import SearchRankingTable from '~/components/admin/search/search_ranking_table.vue'
import SearchSummary from '~/components/admin/search/search_summary.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseTabs from '~/components/base/base_tabs.vue'
import type { RankingRow } from '~/components/admin/types'
import type { SearchInsightsFilters, SearchInsightsReport } from '#shared/types/search_insights'

const props = defineProps<{ report: SearchInsightsReport }>()

const { t, locale } = useI18n()
const { items: adminTabs, label: adminTabsLabel } = useAdminTabs()

const exportHref = computed(() =>
  withSearchParams(urlFor('admin.search.export', { locale: locale.value }), props.report.filters)
)

function visit(filters: SearchInsightsFilters) {
  router.get(urlFor('admin.search.index', { locale: locale.value }), searchParams(filters), {
    preserveState: true,
    preserveScroll: true,
    only: ['report'],
  })
}

const categoryRows = computed<RankingRow[]>(() =>
  props.report.topCategories.map((row) => ({
    id: row.categoryId,
    label: row.name,
    count: row.count,
  }))
)

const filterRows = computed<RankingRow[]>(() =>
  props.report.topFilters.map((row) => ({ id: row.key, label: row.key, count: row.count }))
)

const productRows = computed<RankingRow[]>(() =>
  props.report.topProducts.map((row) => ({
    id: row.targetId,
    label: row.name,
    count: row.views,
    extra: row.rfqAdds,
  }))
)

const supplierRows = computed<RankingRow[]>(() =>
  props.report.topSuppliers.map((row) => ({ id: row.targetId, label: row.name, count: row.views }))
)
</script>

<template>
  <Head :title="t('admin.search.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('admin.search.title')" :description="t('admin.search.subtitle')">
      <template #actions>
        <BaseLinkButton :href="exportHref" variant="secondary" download>
          <Download :size="18" aria-hidden="true" />
          {{ t('admin.search.export') }}
        </BaseLinkButton>
      </template>
    </BasePageHeader>

    <BaseTabs :items="adminTabs" :label="adminTabsLabel" />

    <SearchFilters :filters="report.filters" @change="visit" />

    <BaseEmptyState
      v-if="report.summary.total === 0"
      :title="t('admin.search.empty')"
      :description="t('admin.search.emptyDescription')"
      :icon="SearchX"
    />

    <template v-else>
      <SearchSummary :summary="report.summary" />
      <SearchDailyChart :daily="report.daily" />
    </template>

    <div class="grid gap-8 xl:grid-cols-2">
      <template v-if="report.summary.total > 0">
        <SearchQueriesTable
          :title="t('admin.search.topQueries.title')"
          :description="t('admin.search.topQueries.description')"
          :rows="report.topQueries"
          show-zero-count
        />
        <SearchQueriesTable
          :title="t('admin.search.zeroQueries.title')"
          :description="t('admin.search.zeroQueries.description')"
          :rows="report.zeroResultQueries"
        />
        <SearchRankingTable
          :title="t('admin.search.categories.title')"
          :description="t('admin.search.categories.description')"
          :label-header="t('admin.search.columns.category')"
          :count-header="t('admin.search.columns.searches')"
          :rows="categoryRows"
        />
        <SearchRankingTable
          :title="t('admin.search.filtersUsed.title')"
          :description="t('admin.search.filtersUsed.description')"
          :label-header="t('admin.search.columns.filter')"
          :count-header="t('admin.search.columns.searches')"
          :rows="filterRows"
        />
      </template>
      <SearchRankingTable
        :title="t('admin.search.products.title')"
        :description="t('admin.search.products.description')"
        :label-header="t('admin.search.columns.product')"
        :count-header="t('admin.search.columns.views')"
        :extra-header="t('admin.search.columns.rfqAdds')"
        :rows="productRows"
      />
      <SearchRankingTable
        :title="t('admin.search.suppliers.title')"
        :description="t('admin.search.suppliers.description')"
        :label-header="t('admin.search.columns.supplier')"
        :count-header="t('admin.search.columns.views')"
        :rows="supplierRows"
      />
    </div>
  </div>
</template>
