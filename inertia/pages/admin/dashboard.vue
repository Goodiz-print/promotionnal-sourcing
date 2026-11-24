<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Building2, FileText, Link2, Package, ShieldCheck, UserCheck, Users } from 'lucide-vue-next'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { usePlatformPermissions } from '~/composables/use_platform_permissions'
import KpiOverview from '~/components/admin/kpi_overview.vue'
import KpiPeriodFilter from '~/components/admin/kpi_period_filter.vue'
import HealthSummary from '~/components/admin/health/health_summary.vue'
import QueueHealth from '~/components/admin/queue/queue_health.vue'
import BaseAlert from '~/components/base/base_alert.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseStat from '~/components/base/base_stat.vue'
import type { AdminDashboardStats } from '#shared/types/admin'
import type { AdminKpiFilters, AdminKpiReport } from '#shared/types/admin_kpi'
import type { PlatformHealthSummary } from '#shared/types/admin_health'
import type { QueueHealthReport } from '#shared/types/health'
import type { PlatformPermission } from '#shared/types/user'

defineProps<{
  stats: AdminDashboardStats
  /** `null` pour les rôles sans droit `monitoring.view` : compteurs seuls. */
  kpis: AdminKpiReport | null
  filters: AdminKpiFilters | null
  /** Santé de la queue : `null` sans le droit `queue.manage`. */
  queue?: QueueHealthReport | null
  /** Derniers états de la surveillance : `null` sans le droit `ops.manage`. */
  platform?: PlatformHealthSummary | null
  /** Recherche inerte (pas de `MEILISEARCH_HOST`) et droit `search.manage` : alerte. */
  searchDisabled?: boolean
}>()

const { t, locale } = useI18n()
const { can } = usePlatformPermissions()

function visit(filters: AdminKpiFilters) {
  router.get(urlFor('admin.dashboard', { locale: locale.value }), filters, {
    preserveState: true,
    preserveScroll: true,
    only: ['kpis', 'filters'],
  })
}

type Counter =
  | 'organizations'
  | 'users'
  | 'products'
  | 'rfqs'
  | 'pendingModeration'
  | 'pendingAgencyReviews'
  | 'pendingSupplierLinks'

/**
 * Compteurs du back-office : icône, et liste cible quand une page admin existe
 * (le lien n'est proposé qu'aux rôles qui ont le droit de la consulter).
 */
const COUNTERS: {
  key: Counter
  icon: Component
  route?:
    | 'admin.organizations.index'
    | 'admin.users.index'
    | 'admin.moderation.index'
    | 'admin.agency_reviews.index'
    | 'admin.supplier_links.index'
  permission?: PlatformPermission
  /** Compteur « à traiter » : montré seulement aux rôles qui ont `permission`. */
  gated?: boolean
}[] = [
  {
    key: 'organizations',
    icon: Building2,
    route: 'admin.organizations.index',
    permission: 'organizations.view',
  },
  { key: 'users', icon: Users, route: 'admin.users.index', permission: 'users.view' },
  { key: 'products', icon: Package },
  { key: 'rfqs', icon: FileText },
  {
    key: 'pendingModeration',
    icon: ShieldCheck,
    route: 'admin.moderation.index',
    permission: 'moderation.manage',
    gated: true,
  },
  {
    key: 'pendingAgencyReviews',
    icon: UserCheck,
    route: 'admin.agency_reviews.index',
    permission: 'moderation.manage',
    gated: true,
  },
  {
    key: 'pendingSupplierLinks',
    icon: Link2,
    route: 'admin.supplier_links.index',
    permission: 'organizations.manage',
    gated: true,
  },
]

/** Les compteurs « à traiter » (modération, revue des agences, rattachements) ne sont montrés qu'aux rôles qui peuvent la traiter. */
const counters = computed(() =>
  COUNTERS.filter((counter) => !counter.gated || (counter.permission && can(counter.permission)))
)
</script>

<template>
  <Head :title="t('admin.dashboard.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('admin.dashboard.title')"
      :description="t('admin.dashboard.subtitle')"
    />

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <BaseStat
        v-for="counter in counters"
        :key="counter.key"
        :data-testid="`counter-${counter.key}`"
        :label="t(`admin.dashboard.counters.${counter.key}`)"
        :value="stats[counter.key]"
        :icon="counter.icon"
        :href="
          counter.route && counter.permission && can(counter.permission)
            ? urlFor(counter.route, { locale })
            : undefined
        "
        :hint="
          counter.key === 'organizations'
            ? t('admin.dashboard.archived', { count: stats.archivedOrganizations })
            : undefined
        "
      />
    </div>

    <HealthSummary v-if="platform" :summary="platform" />

    <QueueHealth v-if="queue" :health="queue" linked />

    <BaseAlert v-if="searchDisabled" tone="warning">
      {{ t('admin.search.dashboardAlert') }}
      <Link :href="urlFor('admin.search.index', { locale })" class="ml-2 font-semibold underline">
        {{ t('admin.search.dashboardLink') }}
      </Link>
    </BaseAlert>

    <template v-if="kpis && filters">
      <KpiPeriodFilter :filters="filters" @change="visit" />
      <KpiOverview :report="kpis" />
    </template>
  </div>
</template>
