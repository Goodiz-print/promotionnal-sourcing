<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { useUserListVisit } from '~/composables/use_user_list_visit'
import UserFilters from '~/components/admin/user_filters.vue'
import UserList from '~/components/admin/user_list.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import type { AdminUserListItem, AdminUsersRolesProps } from '#shared/types/admin'
import type { AdminUserFilterOptions, AdminUserIndexFilters } from '#shared/types/admin_user'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<
  {
    users: Paginated<AdminUserListItem>
    filters: AdminUserIndexFilters
    filterOptions: AdminUserFilterOptions
    canSupport: boolean
    canManage: boolean
  } & AdminUsersRolesProps
>()

const { t } = useI18n()
const { visit } = useUserListVisit()
</script>

<template>
  <Head :title="t('admin.users.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('admin.users.title')" :description="t('admin.users.subtitle')" />

    <UserFilters :filters="filters" :options="filterOptions" @change="visit" />

    <UserList
      :users="users"
      :can-manage-roles="canManageRoles"
      :current-user-id="currentUserId"
      @page="(page) => visit(props.filters, page)"
    />
  </div>
</template>
