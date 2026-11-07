<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import StorageOrganizations from '~/components/admin/storage/storage_organizations.vue'
import StorageStale from '~/components/admin/storage/storage_stale.vue'
import StorageTotals from '~/components/admin/storage/storage_totals.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import type { AdminStorageOverview } from '#shared/types/admin_ops'

defineProps<{ overview: AdminStorageOverview }>()

const { t } = useI18n()
</script>

<template>
  <Head :title="t('admin.storage.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('admin.storage.title')" :description="t('admin.storage.subtitle')" />

    <StorageTotals :overview="overview" />
    <StorageStale :overview="overview" />
    <StorageOrganizations :overview="overview" />
  </div>
</template>
