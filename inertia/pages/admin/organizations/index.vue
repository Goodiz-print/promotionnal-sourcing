<script setup lang="ts">
import { ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import AdminNav from '~/components/admin/admin_nav.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BasePagination from '~/components/base/base_pagination.vue'
import BaseSelect from '~/components/base/base_select.vue'
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

  <div class="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-12">
    <AdminNav current="organizations" />

    <div>
      <h1 class="mb-1.25 text-[28px] tracking-[-0.5px]">{{ t('admin.organizations.title') }}</h1>
      <p class="text-sm text-[var(--gray-6)]">{{ t('admin.organizations.subtitle') }}</p>
    </div>

    <div class="flex flex-col gap-4 sm:flex-row">
      <div class="sm:w-56">
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
      </div>
      <div class="sm:w-56">
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
    </div>

    <p v-if="organizationList.data.length === 0" class="text-[var(--gray-6)]">
      {{ t('admin.organizations.empty') }}
    </p>

    <table v-else class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-[var(--gray-4)] text-left text-[var(--gray-6)]">
          <th class="py-2 pr-4 font-medium">{{ t('admin.organizations.columns.name') }}</th>
          <th class="py-2 pr-4 font-medium">{{ t('admin.organizations.columns.type') }}</th>
          <th class="py-2 pr-4 font-medium">{{ t('admin.organizations.columns.members') }}</th>
          <th class="py-2 pr-4 font-medium">{{ t('admin.organizations.columns.status') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="organization in organizationList.data"
          :key="organization.id"
          class="border-b border-[var(--gray-3)]"
        >
          <td class="py-3 pr-4 font-medium">
            <Link
              route="admin.organizations.show"
              :params="{ locale, id: organization.id }"
              class="hover:underline"
            >
              {{ organization.name }}
            </Link>
          </td>
          <td class="py-3 pr-4 text-[var(--gray-6)]">
            {{ t(`admin.organizations.types.${organization.organizationType}`) }}
          </td>
          <td class="py-3 pr-4 text-[var(--gray-6)]">{{ organization.membersCount }}</td>
          <td class="py-3 pr-4">
            <BaseBadge :tone="organization.archivedAt ? 'warning' : 'success'">
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
      </tbody>
    </table>

    <BasePagination
      :meta="organizationList.meta"
      :previous-label="t('admin.pagination.previous')"
      :next-label="t('admin.pagination.next')"
      @change="visit"
    />
  </div>
</template>
