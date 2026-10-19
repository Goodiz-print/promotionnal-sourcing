<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import AdminNav from '~/components/admin/admin_nav.vue'
import type { AdminDashboardStats } from '#shared/types/admin'

defineProps<{ stats: AdminDashboardStats }>()

const { t } = useI18n()

const COUNTERS = ['organizations', 'users', 'products', 'rfqs'] as const
</script>

<template>
  <Head :title="t('admin.dashboard.title')" />

  <div class="mx-auto flex w-full max-w-[960px] flex-col px-6 py-12">
    <AdminNav current="dashboard" />

    <h1 class="mb-1.25 text-[28px] tracking-[-0.5px]">{{ t('admin.dashboard.title') }}</h1>
    <p class="mb-8 text-sm text-[var(--gray-6)]">{{ t('admin.dashboard.subtitle') }}</p>

    <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="counter in COUNTERS"
        :key="counter"
        class="rounded border border-[var(--gray-4)] p-5"
      >
        <dt class="text-sm text-[var(--gray-6)]">{{ t(`admin.dashboard.counters.${counter}`) }}</dt>
        <dd class="mt-1 text-3xl font-medium" :data-testid="`counter-${counter}`">
          {{ stats[counter] }}
        </dd>
        <p v-if="counter === 'organizations'" class="mt-1 text-xs text-[var(--gray-6)]">
          {{ t('admin.dashboard.archived', { count: stats.archivedOrganizations }) }}
        </p>
      </div>
    </dl>
  </div>
</template>
