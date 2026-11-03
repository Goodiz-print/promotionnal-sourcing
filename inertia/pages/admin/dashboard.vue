<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Head } from '@inertiajs/vue3'
import { Building2, FileText, Package, ShieldCheck, Users } from 'lucide-vue-next'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { useAdminTabs } from '~/composables/use_admin_tabs'
import { usePlatformPermissions } from '~/composables/use_platform_permissions'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseStat from '~/components/base/base_stat.vue'
import BaseTabs from '~/components/base/base_tabs.vue'
import type { AdminDashboardStats } from '#shared/types/admin'
import type { PlatformPermission } from '#shared/types/user'

defineProps<{ stats: AdminDashboardStats }>()

const { t, locale } = useI18n()
const { items: adminTabs, label: adminTabsLabel } = useAdminTabs()
const { can } = usePlatformPermissions()

type Counter = 'organizations' | 'users' | 'products' | 'rfqs' | 'pendingModeration'

/**
 * Compteurs du back-office : icône, et liste cible quand une page admin existe
 * (le lien n'est proposé qu'aux rôles qui ont le droit de la consulter).
 */
const COUNTERS: {
  key: Counter
  icon: Component
  route?: 'admin.organizations.index' | 'admin.users.index' | 'admin.moderation.index'
  permission?: PlatformPermission
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
  },
]

/** Le compteur de modération n'est montré qu'aux rôles qui peuvent la traiter. */
const counters = computed(() =>
  COUNTERS.filter((counter) => counter.key !== 'pendingModeration' || can('moderation.manage'))
)
</script>

<template>
  <Head :title="t('admin.dashboard.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('admin.dashboard.title')"
      :description="t('admin.dashboard.subtitle')"
    />

    <BaseTabs :items="adminTabs" :label="adminTabsLabel" />

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
  </div>
</template>
