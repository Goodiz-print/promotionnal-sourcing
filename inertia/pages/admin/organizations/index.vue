<script setup lang="ts">
import { ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Building2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseTable from '~/components/base/base_table.vue'
import type {
  AdminOrganizationFilters,
  AdminOrganizationListItem,
  AdminOrganizationStatus,
} from '#shared/types/admin'
import type { OrganizationKind } from '#shared/types/organization'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<{
  organizationList: Paginated<AdminOrganizationListItem>
  filters: AdminOrganizationFilters
}>()

const { t, locale } = useI18n()

const type = ref<OrganizationKind | ''>(props.filters.type ?? '')
const status = ref<AdminOrganizationStatus>(props.filters.status)

function visit(page: number) {
  router.get(
    urlFor('admin.organizations.index', { locale: locale.value }),
    { type: type.value || undefined, status: status.value, page },
    { preserveState: true, preserveScroll: true, only: ['organizationList', 'filters'] }
  )
}
</script>

<template>
  <Head :title="t('admin.organizations.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('admin.organizations.title')"
      :description="t('admin.organizations.subtitle')"
    />

    <BaseCard padding="md">
      <div class="grid gap-4 sm:grid-cols-[200px_200px]">
        <BaseSelect
          id="type"
          v-model="type"
          :label="t('admin.organizations.filters.type')"
          @update:model-value="visit(1)"
        >
          <option value="">{{ t('admin.organizations.filters.allTypes') }}</option>
          <option value="buyer">{{ t('admin.organizations.types.buyer') }}</option>
          <option value="supplier">{{ t('admin.organizations.types.supplier') }}</option>
          <option value="both">{{ t('admin.organizations.types.both') }}</option>
        </BaseSelect>
        <BaseSelect
          id="status"
          v-model="status"
          :label="t('admin.organizations.filters.status')"
          @update:model-value="visit(1)"
        >
          <option value="active">{{ t('admin.organizations.status.active') }}</option>
          <option value="archived">{{ t('admin.organizations.status.archived') }}</option>
          <option value="all">{{ t('admin.organizations.status.all') }}</option>
        </BaseSelect>
      </div>
    </BaseCard>

    <div class="flex flex-col gap-4">
      <p class="text-tabular text-body-sm text-text-secondary">
        {{ t('admin.organizations.resultsCount', { count: organizationList.meta.total }) }}
      </p>

      <BaseEmptyState
        v-if="organizationList.data.length === 0"
        :title="t('admin.organizations.empty')"
        :description="t('admin.organizations.emptyDescription')"
        :icon="Building2"
      />

      <BaseTable v-else :caption="t('admin.organizations.title')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.organizations.columns.name') }}</th>
            <th scope="col">{{ t('admin.organizations.columns.type') }}</th>
            <th scope="col" class="text-right">{{ t('admin.organizations.columns.members') }}</th>
            <th scope="col">{{ t('admin.organizations.columns.status') }}</th>
          </tr>
        </template>

        <tr v-for="organization in organizationList.data" :key="organization.id">
          <td>
            <Link
              route="admin.organizations.show"
              :params="{ locale, id: organization.id }"
              class="font-semibold text-text-primary hover:text-indigo-600"
            >
              {{ organization.name }}
            </Link>
          </td>
          <td class="text-text-secondary">
            {{ t(`admin.organizations.types.${organization.organizationType}`) }}
          </td>
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
        </tr>
      </BaseTable>

      <BasePagination
        :meta="organizationList.meta"
        :previous-label="t('admin.pagination.previous')"
        :next-label="t('admin.pagination.next')"
        @change="visit"
      />
    </div>
  </div>
</template>
