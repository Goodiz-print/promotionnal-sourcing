<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BuyerSummary from '~/components/dashboard/buyer_summary.vue'
import SupplierSummary from '~/components/dashboard/supplier_summary.vue'
import type { DashboardType } from '#shared/types/dashboard'

defineProps<{ dashboard: DashboardType }>()

const { t } = useI18n()
</script>

<template>
  <Head :title="t('dashboard.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('dashboard.title')" :description="t('dashboard.subtitle')" />

    <BuyerSummary v-if="dashboard.buyer" :buyer="dashboard.buyer" />
    <SupplierSummary v-if="dashboard.supplier" :supplier="dashboard.supplier" />
  </div>
</template>
