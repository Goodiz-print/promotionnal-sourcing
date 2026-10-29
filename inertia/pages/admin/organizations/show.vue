<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { FileText, Package, Users } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useAdminTabs } from '~/composables/use_admin_tabs'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseDescriptionItem from '~/components/base/base_description_item.vue'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseStat from '~/components/base/base_stat.vue'
import BaseTable from '~/components/base/base_table.vue'
import BaseTabs from '~/components/base/base_tabs.vue'
import { ORGANIZATION_ROLE_TONES } from '~/components/admin/types'
import type { AdminOrganizationDetail } from '#shared/types/admin'

defineProps<{ organization: AdminOrganizationDetail }>()

const { t, locale } = useI18n()
const { items: adminTabs, label: adminTabsLabel } = useAdminTabs()

const indexUrl = computed(() => urlFor('admin.organizations.index', { locale: locale.value }))

const FIELDS = ['email', 'phone', 'website', 'siret', 'vatNumber', 'country'] as const

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(locale.value)
}
</script>

<template>
  <Head :title="organization.name" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="organization.name"
      :description="organization.slug"
      :back-href="indexUrl"
      :back-label="t('admin.organizations.back')"
    >
      <template #meta>
        <BaseBadge dot :tone="organization.archivedAt ? 'warning' : 'success'">
          {{
            t(
              organization.archivedAt
                ? 'admin.organizations.status.archived'
                : 'admin.organizations.status.active'
            )
          }}
        </BaseBadge>
        <BaseBadge tone="brand">
          {{ t(`admin.organizations.types.${organization.organizationType}`) }}
        </BaseBadge>
      </template>
    </BasePageHeader>

    <BaseTabs :items="adminTabs" :label="adminTabsLabel" />

    <div class="grid gap-4 sm:grid-cols-3">
      <BaseStat
        :label="t('admin.organizations.columns.members')"
        :value="organization.membersCount"
        :icon="Users"
      />
      <BaseStat
        :label="t('admin.organizations.detail.products')"
        :value="organization.productsCount"
        :icon="Package"
      />
      <BaseStat
        :label="t('admin.organizations.detail.rfqs')"
        :value="organization.rfqsCount"
        :icon="FileText"
      />
    </div>

    <BaseSection :title="t('admin.organizations.detail.contact')">
      <BaseDescriptionList :columns="2">
        <BaseDescriptionItem
          v-for="field in FIELDS"
          :key="field"
          :label="t(`admin.organizations.fields.${field}`)"
        >
          <template v-if="organization[field]">{{ organization[field] }}</template>
          <span v-else class="text-text-muted">
            {{ t('admin.organizations.detail.notProvided') }}
          </span>
        </BaseDescriptionItem>
        <BaseDescriptionItem :label="t('admin.organizations.fields.createdAt')">
          <span class="text-tabular">{{ formatDate(organization.createdAt) }}</span>
        </BaseDescriptionItem>
      </BaseDescriptionList>
    </BaseSection>

    <BaseSection
      :title="t('admin.organizations.detail.members', { count: organization.members.length })"
      flush
    >
      <div v-if="organization.members.length === 0" class="p-6">
        <BaseEmptyState
          :title="t('admin.organizations.detail.membersEmpty')"
          :icon="Users"
          compact
        />
      </div>

      <BaseTable v-else bare :caption="t('admin.organizations.detail.membersCaption')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.users.columns.name') }}</th>
            <th scope="col">{{ t('admin.users.columns.email') }}</th>
            <th scope="col">{{ t('admin.organizations.detail.role') }}</th>
            <th scope="col">{{ t('admin.organizations.detail.joinedAt') }}</th>
          </tr>
        </template>

        <tr v-for="member in organization.members" :key="member.id">
          <td>
            <template v-if="member.fullName">
              <span class="font-semibold text-text-primary">{{ member.fullName }}</span>
            </template>
            <span v-else class="text-text-muted">{{ t('admin.users.noName') }}</span>
          </td>
          <td class="text-text-secondary">{{ member.email }}</td>
          <td>
            <BaseBadge dot :tone="ORGANIZATION_ROLE_TONES[member.roleSlug]">
              {{ t(`admin.organizations.roles.${member.roleSlug}`) }}
            </BaseBadge>
          </td>
          <td class="text-tabular whitespace-nowrap">{{ formatDate(member.joinedAt) }}</td>
        </tr>
      </BaseTable>
    </BaseSection>
  </div>
</template>
