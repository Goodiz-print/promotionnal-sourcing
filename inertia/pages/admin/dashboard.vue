<script setup lang="ts">
import type { Component } from 'vue'
import { Head } from '@inertiajs/vue3'
import { Building2, FileText, Package, Users } from 'lucide-vue-next'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { useAdminTabs } from '~/composables/use_admin_tabs'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseStat from '~/components/base/base_stat.vue'
import BaseTabs from '~/components/base/base_tabs.vue'
import type { AdminDashboardStats } from '#shared/types/admin'

defineProps<{ stats: AdminDashboardStats }>()

const { t, locale } = useI18n()
const { items: adminTabs, label: adminTabsLabel } = useAdminTabs()

type Counter = 'organizations' | 'users' | 'products' | 'rfqs'

/** Compteurs du back-office : icône, et liste cible quand une page admin existe. */
const COUNTERS: {
  key: Counter
  icon: Component
  route?: 'admin.organizations.index' | 'admin.users.index'
}[] = [
  { key: 'organizations', icon: Building2, route: 'admin.organizations.index' },
  { key: 'users', icon: Users, route: 'admin.users.index' },
  { key: 'products', icon: Package },
  { key: 'rfqs', icon: FileText },
]
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
        v-for="counter in COUNTERS"
        :key="counter.key"
        :data-testid="`counter-${counter.key}`"
        :label="t(`admin.dashboard.counters.${counter.key}`)"
        :value="stats[counter.key]"
        :icon="counter.icon"
        :href="counter.route ? urlFor(counter.route, { locale }) : undefined"
        :hint="
          counter.key === 'organizations'
            ? t('admin.dashboard.archived', { count: stats.archivedOrganizations })
            : undefined
        "
      />
    </div>
  </div>
</template>
