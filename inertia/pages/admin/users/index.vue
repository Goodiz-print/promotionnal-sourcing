<script setup lang="ts">
import { ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useAdminTabs } from '~/composables/use_admin_tabs'
import BaseTabs from '~/components/base/base_tabs.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseInput from '~/components/base/base_input.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import type { AdminUserFilters, AdminUserListItem } from '#shared/types/admin'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<{
  users: Paginated<AdminUserListItem>
  filters: AdminUserFilters
}>()

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
</script>

<template>
  <Head :title="t('admin.users.title')" />

  <div class="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-12">
    <BaseTabs :items="adminTabs" :label="adminTabsLabel" />

    <div>
      <h1 class="mb-1.25 text-[28px] tracking-[-0.5px]">{{ t('admin.users.title') }}</h1>
      <p class="text-sm text-[var(--gray-6)]">{{ t('admin.users.subtitle') }}</p>
    </div>

    <div class="sm:w-80">
      <BaseInput
        id="search"
        v-model="search"
        type="text"
        :label="t('admin.users.searchLabel')"
        :placeholder="t('admin.users.searchPlaceholder')"
        @update:model-value="onSearch"
      />
    </div>

    <p v-if="users.data.length === 0" class="text-[var(--gray-6)]">
      {{ t('admin.users.empty') }}
    </p>

    <table v-else class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-[var(--gray-4)] text-left text-[var(--gray-6)]">
          <th class="py-2 pr-4 font-medium">{{ t('admin.users.columns.name') }}</th>
          <th class="py-2 pr-4 font-medium">{{ t('admin.users.columns.email') }}</th>
          <th class="py-2 pr-4 font-medium">{{ t('admin.users.columns.organizations') }}</th>
          <th class="py-2 pr-4 font-medium">{{ t('admin.users.columns.status') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users.data" :key="user.id" class="border-b border-[var(--gray-3)]">
          <td class="py-3 pr-4 font-medium">{{ user.fullName ?? '—' }}</td>
          <td class="py-3 pr-4 text-[var(--gray-6)]">{{ user.email }}</td>
          <td class="py-3 pr-4 text-[var(--gray-6)]">{{ user.organizationsCount }}</td>
          <td class="flex gap-2 py-3 pr-4">
            <BaseBadge v-if="user.platformRole === 'admin'" tone="info">
              {{ t('admin.users.platformAdmin') }}
            </BaseBadge>
            <BaseBadge v-if="!user.emailVerified" tone="warning">
              {{ t('admin.users.unverified') }}
            </BaseBadge>
          </td>
        </tr>
      </tbody>
    </table>

    <BasePagination
      :meta="users.meta"
      :previous-label="t('admin.pagination.previous')"
      :next-label="t('admin.pagination.next')"
      @change="visit"
    />
  </div>
</template>
