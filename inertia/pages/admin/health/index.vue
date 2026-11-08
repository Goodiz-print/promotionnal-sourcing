<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import HealthComponents from '~/components/admin/health/health_components.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import type { PlatformHealthReport, PlatformHealthSummary } from '#shared/types/admin_health'

defineProps<{ report: PlatformHealthReport; summary: PlatformHealthSummary }>()

const { t } = useI18n()
</script>

<template>
  <Head :title="t('admin.health.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('admin.health.title')" :description="t('admin.health.subtitle')" />

    <HealthComponents :report="report" :states="summary.components" />
  </div>
</template>
