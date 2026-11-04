<script setup lang="ts">
import { Users } from 'lucide-vue-next'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import PlatformRoleSelect from '~/components/admin/platform_role_select.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminUserListItem } from '#shared/types/admin'
import type { Paginated } from '#shared/types/pagination'

/** Tableau paginé des comptes : lien vers la fiche, rôle, statut, dernière connexion. */
defineProps<{
  users: Paginated<AdminUserListItem>
  canManageRoles: boolean
  currentUserId: number
}>()
const emit = defineEmits<{ page: [page: number] }>()

const { t, locale } = useI18n()

const showUrl = (user: AdminUserListItem) =>
  urlFor('admin.users.show', { locale: locale.value, id: user.id })

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(locale.value)
}
</script>

<template>
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
          <th scope="col">{{ t('admin.users.columns.lastLogin') }}</th>
          <th scope="col">{{ t('admin.users.columns.createdAt') }}</th>
        </tr>
      </template>

      <tr v-for="user in users.data" :key="user.id">
        <td>
          <Link :href="showUrl(user)" class="font-semibold text-text-primary hover:text-indigo-600">
            {{ user.fullName || t('admin.users.noName') }}
          </Link>
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
            <BaseBadge v-if="user.suspendedAt" dot tone="danger">
              {{ t('admin.users.show.suspended') }}
            </BaseBadge>
            <BaseBadge v-if="!user.emailVerified" dot tone="warning">
              {{ t('admin.users.unverified') }}
            </BaseBadge>
            <BaseBadge v-else dot tone="success">{{ t('admin.users.verified') }}</BaseBadge>
          </div>
        </td>
        <td class="text-tabular whitespace-nowrap">
          <template v-if="user.lastLoginAt">{{ formatDate(user.lastLoginAt) }}</template>
          <span v-else class="text-text-muted">{{ t('admin.users.show.never') }}</span>
        </td>
        <td class="text-tabular whitespace-nowrap">{{ formatDate(user.createdAt) }}</td>
      </tr>
    </BaseTable>

    <BasePagination
      :meta="users.meta"
      :previous-label="t('admin.pagination.previous')"
      :next-label="t('admin.pagination.next')"
      @change="(page) => emit('page', page)"
    />
  </div>
</template>
