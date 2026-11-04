<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { useOrganizationListVisit } from '~/composables/use_organization_list_visit'
import OrganizationFilters from '~/components/admin/organization_filters.vue'
import OrganizationList from '~/components/admin/organization_list.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import type {
  AdminOrganizationFilterOptions,
  AdminOrganizationIndexFilters,
  AdminOrganizationListItem,
} from '#shared/types/admin_organization'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<{
  organizationList: Paginated<AdminOrganizationListItem>
  filters: AdminOrganizationIndexFilters
  filterOptions: AdminOrganizationFilterOptions
  canManage: boolean
}>()

const { t } = useI18n()
const { visit } = useOrganizationListVisit()
</script>

<template>
  <Head :title="t('admin.organizations.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('admin.organizations.title')"
      :description="t('admin.organizations.subtitle')"
    />

    <OrganizationFilters :filters="filters" :options="filterOptions" @change="visit" />

    <OrganizationList
      :organizations="organizationList"
      @page="(page) => visit(props.filters, page)"
    />
  </div>
</template>
