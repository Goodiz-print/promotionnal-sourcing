<script setup lang="ts">
import { Building2 } from 'lucide-vue-next'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminOrganizationListItem } from '#shared/types/admin_organization'
import type { Paginated } from '#shared/types/pagination'

/** Tableau paginé des organisations : lien vers la fiche, type, pays, membres, activité. */
defineProps<{ organizations: Paginated<AdminOrganizationListItem> }>()
const emit = defineEmits<{ page: [page: number] }>()

const { t, locale } = useI18n()

const showUrl = (organization: AdminOrganizationListItem) =>
  urlFor('admin.organizations.show', { locale: locale.value, id: organization.id })

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(locale.value)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-tabular text-body-sm text-text-secondary">
      {{ t('admin.organizations.resultsCount', { count: organizations.meta.total }) }}
    </p>

    <BaseEmptyState
      v-if="organizations.data.length === 0"
      :title="t('admin.organizations.empty')"
      :description="t('admin.organizations.emptyDescription')"
      :icon="Building2"
    />

    <BaseTable v-else :caption="t('admin.organizations.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.organizations.columns.name') }}</th>
          <th scope="col">{{ t('admin.organizations.columns.type') }}</th>
          <th scope="col">{{ t('admin.organizations.columns.country') }}</th>
          <th scope="col" class="text-right">{{ t('admin.organizations.columns.members') }}</th>
          <th scope="col">{{ t('admin.organizations.columns.status') }}</th>
          <th scope="col">{{ t('admin.organizations.columns.lastActivity') }}</th>
        </tr>
      </template>

      <tr v-for="organization in organizations.data" :key="organization.id">
        <td>
          <Link
            :href="showUrl(organization)"
            class="font-semibold text-text-primary hover:text-indigo-600"
          >
            {{ organization.name }}
          </Link>
        </td>
        <td class="text-text-secondary">
          {{ t(`admin.organizations.types.${organization.organizationType}`) }}
        </td>
        <td class="text-text-secondary">{{ organization.country }}</td>
        <td class="text-tabular text-right">{{ organization.membersCount }}</td>
        <td>
          <BaseBadge dot :tone="organization.archivedAt ? 'warning' : 'success'">
            {{
              t(
                organization.archivedAt
                  ? 'admin.organizations.status.archived'
                  : 'admin.organizations.status.active'
              )
            }}
          </BaseBadge>
        </td>
        <td class="text-tabular whitespace-nowrap">
          <template v-if="organization.lastActivity">
            {{ formatDate(organization.lastActivity) }}
          </template>
          <span v-else class="text-text-muted">{{ t('admin.users.show.never') }}</span>
        </td>
      </tr>
    </BaseTable>

    <BasePagination
      :meta="organizations.meta"
      :previous-label="t('admin.pagination.previous')"
      :next-label="t('admin.pagination.next')"
      @change="(page) => emit('page', page)"
    />
  </div>
</template>
