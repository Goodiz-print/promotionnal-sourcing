<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import BuyerSummary from '~/components/dashboard/buyer_summary.vue'
import SupplierSummary from '~/components/dashboard/supplier_summary.vue'
import type { DashboardType } from '#shared/types/dashboard'

defineProps<{ dashboard: DashboardType }>()

const { t } = useI18n()
</script>

<template>
  <Head :title="t('dashboard.title')" />

  <div class="mx-auto flex w-full max-w-[960px] flex-col px-6 py-12">
    <h1 class="mb-1.25 text-[28px] tracking-[-0.5px]">{{ t('dashboard.title') }}</h1>
    <p class="mb-8 text-sm text-[var(--gray-6)]">{{ t('dashboard.subtitle') }}</p>

    <BuyerSummary v-if="dashboard.buyer" :buyer="dashboard.buyer" />
    <SupplierSummary v-if="dashboard.supplier" :supplier="dashboard.supplier" />
  </div>
</template>
