<script setup lang="ts">
import { ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Search, Users } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useAdminTabs } from '~/composables/use_admin_tabs'
import PlatformRoleSelect from '~/components/admin/platform_role_select.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseInput from '~/components/base/base_input.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import BaseTable from '~/components/base/base_table.vue'
import BaseTabs from '~/components/base/base_tabs.vue'
import type { AdminUserFilters, AdminUserListItem, AdminUsersRolesProps } from '#shared/types/admin'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<
  {
    users: Paginated<AdminUserListItem>
    filters: AdminUserFilters
  } & AdminUsersRolesProps
>()

const { t, locale } = useI18n()
const { items: adminTabs, label: adminTabsLabel } = useAdminTabs()

const search = ref(props.filters.search ?? '')

function visit(page: number) {
  router.get(
    urlFor('admin.users.index', { locale: locale.value }),
    { search: search.value || undefined, page },
    { preserveState: true, preserveScroll: true, only: ['users', 'filters'] }
  )
}

let debounce: ReturnType<typeof setTimeout>
function onSearch() {
  clearTimeout(debounce)
  debounce = setTimeout(() => visit(1), 300)
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(locale.value)
}
</script>

<template>
  <Head :title="t('admin.users.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('admin.users.title')" :description="t('admin.users.subtitle')" />

    <BaseTabs :items="adminTabs" :label="adminTabsLabel" />

    <BaseCard padding="md">
      <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <BaseInput
          id="search"
          v-model="search"
          type="search"
          :label="t('admin.users.searchLabel')"
          :placeholder="t('admin.users.searchPlaceholder')"
          @update:model-value="onSearch"
        >
          <template #prefix><Search :size="16" aria-hidden="true" /></template>
        </BaseInput>
      </div>
    </BaseCard>

    <div class="flex flex-col gap-4">
      <p class="text-tabular text-body-sm text-text-secondary">
        {{ t('admin.users.resultsCount', { count: users.meta.total }) }}
      </p>

      <BaseEmptyState
        v-if="users.data.length === 0"
        :title="t('admin.users.empty')"
        :description="t('admin.users.emptyDescription')"
        :icon="Users"
      />

      <BaseTable v-else :caption="t('admin.users.title')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.users.columns.name') }}</th>
            <th scope="col">{{ t('admin.users.columns.email') }}</th>
            <th scope="col" class="text-right">{{ t('admin.users.columns.organizations') }}</th>
            <th scope="col">{{ t('admin.users.columns.role') }}</th>
            <th scope="col">{{ t('admin.users.columns.status') }}</th>
            <th scope="col">{{ t('admin.users.columns.createdAt') }}</th>
          </tr>
        </template>

        <tr v-for="user in users.data" :key="user.id">
          <td>
            <span v-if="user.fullName" class="font-semibold text-text-primary">
              {{ user.fullName }}
            </span>
            <span v-else class="text-text-muted">{{ t('admin.users.noName') }}</span>
          </td>
          <td class="text-text-secondary">{{ user.email }}</td>
          <td class="text-tabular text-right">{{ user.organizationsCount }}</td>
          <td class="w-52">
            <PlatformRoleSelect
              v-if="canManageRoles && user.id !== currentUserId"
              :user-id="user.id"
              :platform-role="user.platformRole"
            />
            <BaseBadge v-else-if="user.platformRole !== 'none'" dot tone="brand">
              {{ t(`admin.users.roles.${user.platformRole}`) }}
            </BaseBadge>
            <span v-else class="text-text-muted">{{ t('admin.users.roles.none') }}</span>
          </td>
          <td>
            <div class="flex flex-wrap items-center gap-2">
              <BaseBadge v-if="!user.emailVerified" dot tone="warning">
                {{ t('admin.users.unverified') }}
              </BaseBadge>
              <BaseBadge v-else dot tone="success">{{ t('admin.users.verified') }}</BaseBadge>
            </div>
          </td>
          <td class="text-tabular whitespace-nowrap">{{ formatDate(user.createdAt) }}</td>
        </tr>
      </BaseTable>

      <BasePagination
        :meta="users.meta"
        :previous-label="t('admin.pagination.previous')"
        :next-label="t('admin.pagination.next')"
        @change="visit"
      />
    </div>
  </div>
</template>
