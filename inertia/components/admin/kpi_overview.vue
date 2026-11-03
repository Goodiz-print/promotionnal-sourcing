<script setup lang="ts">
import { computed } from 'vue'
import { Banknote, ShieldAlert } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useKpiFormat } from '~/composables/use_kpi_format'
import { useKpiItems } from '~/composables/use_kpi_items'
import DemandRanking from '~/components/admin/demand_ranking.vue'
import KpiDaily from '~/components/admin/kpi_daily.vue'
import KpiGroup from '~/components/admin/kpi_group.vue'
import BaseStat from '~/components/base/base_stat.vue'
import type { RankingRow } from '~/components/admin/types'
import type { AdminKpiReport } from '#shared/types/admin_kpi'

/**
 * Corps du tableau de bord KPI : comptes, demandes de devis, devis, commandes,
 * catalogue, éléments à traiter et activité quotidienne. Chaque indicateur est
 * comparé à la période précédente de même durée.
 */
const props = defineProps<{ report: AdminKpiReport }>()

const { t } = useI18n()
const { value, money } = useKpiFormat()

const { accounts, rfqs, quotes, orders } = useKpiItems(() => props.report)

const rfqStatusRows = computed<RankingRow[]>(() =>
  props.report.rfqs.byStatus.map((row) => ({
    key: row.status,
    label: t(`rfq.status.${row.status}`),
    value: row.count,
  }))
)

const organizationTypeRows = computed<RankingRow[]>(() =>
  props.report.accounts.organizationsByType.map((row) => ({
    key: row.type,
    label: t(`admin.demand.organizationTypes.${row.type}`),
    value: row.count,
  }))
)

const lifecycleRows = computed<RankingRow[]>(() =>
  props.report.catalogue.byLifecycle.map((row) => ({
    key: row.status,
    label: t(`products.manage.lifecycle.${row.status}`),
    value: row.count,
  }))
)

const coverageRows = computed<RankingRow[]>(() =>
  props.report.catalogue.translationCoverage.map((row) => ({
    key: row.locale,
    label: row.locale.toUpperCase(),
    value: value(row.rate, 'percent'),
  }))
)
</script>

<template>
  <div class="flex flex-col gap-8">
    <KpiGroup :title="t('admin.dashboard.kpi.groups.accounts')" :items="accounts" />
    <div class="grid gap-8 lg:grid-cols-2">
      <DemandRanking
        :title="t('admin.dashboard.kpi.organizationTypes')"
        :label-header="t('admin.dashboard.kpi.columns.type')"
        :value-header="t('admin.dashboard.kpi.columns.count')"
        :rows="organizationTypeRows"
      />
    </div>

    <KpiGroup :title="t('admin.dashboard.kpi.groups.rfqs')" :items="rfqs" />
    <div class="grid gap-8 lg:grid-cols-2">
      <DemandRanking
        :title="t('admin.dashboard.kpi.rfqStatuses')"
        :label-header="t('admin.dashboard.kpi.columns.status')"
        :value-header="t('admin.dashboard.kpi.columns.count')"
        :rows="rfqStatusRows"
      />
    </div>

    <KpiGroup :title="t('admin.dashboard.kpi.groups.quotes')" :items="quotes" />

    <KpiGroup :title="t('admin.dashboard.kpi.groups.orders')" :items="orders">
      <BaseStat
        v-for="amount in report.orders.gmv"
        :key="amount.currency"
        :data-testid="`kpi-gmv-${amount.currency}`"
        :label="t('admin.dashboard.kpi.metrics.gmv', { currency: amount.currency })"
        :value="money(amount.current, amount.currency)"
        :hint="
          t('admin.dashboard.kpi.previous', { value: money(amount.previous, amount.currency) })
        "
        :icon="Banknote"
      />
    </KpiGroup>

    <section class="flex flex-col gap-3" :aria-label="t('admin.dashboard.kpi.groups.toHandle')">
      <h2 class="text-heading-md">{{ t('admin.dashboard.kpi.groups.toHandle') }}</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BaseStat
          data-testid="kpi-agencyReviews"
          :label="t('admin.dashboard.kpi.metrics.agencyReviews')"
          :value="value(report.toHandle.agencyReviews, 'count')"
          :hint="t('admin.dashboard.kpi.agencyReviewsHint')"
          :icon="ShieldAlert"
        />
      </div>
    </section>

    <section class="flex flex-col gap-3" :aria-label="t('admin.dashboard.kpi.groups.catalogue')">
      <h2 class="text-heading-md">{{ t('admin.dashboard.kpi.groups.catalogue') }}</h2>
      <div class="grid gap-8 lg:grid-cols-2">
        <DemandRanking
          :title="t('admin.dashboard.kpi.lifecycle')"
          :label-header="t('admin.dashboard.kpi.columns.status')"
          :value-header="t('admin.dashboard.kpi.columns.count')"
          :rows="lifecycleRows"
        />
        <DemandRanking
          :title="t('admin.dashboard.kpi.coverage')"
          :description="t('admin.dashboard.kpi.coverageHint')"
          :label-header="t('admin.dashboard.kpi.columns.locale')"
          :value-header="t('admin.dashboard.kpi.columns.coverage')"
          :rows="coverageRows"
        />
      </div>
    </section>

    <KpiDaily :rows="report.daily" />
  </div>
</template>
