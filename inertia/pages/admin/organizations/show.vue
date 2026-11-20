<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { FileText, Package, Users } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { usePlatformPermissions } from '~/composables/use_platform_permissions'
import OrganizationConsentsSection from '~/components/admin/organization/organization_consents_section.vue'
import OrganizationInfoForm from '~/components/admin/organization/organization_info_form.vue'
import OrganizationInvitationsSection from '~/components/admin/organization/organization_invitations_section.vue'
import OrganizationLifecycleActions from '~/components/admin/organization/organization_lifecycle_actions.vue'
import OrganizationMembersSection from '~/components/admin/organization/organization_members_section.vue'
import OrganizationOverview from '~/components/admin/organization/organization_overview.vue'
import OrganizationProfilesSection from '~/components/admin/organization/organization_profiles_section.vue'
import OrganizationSubscriptionSection from '~/components/admin/organization/organization_subscription_section.vue'
import OrganizationTypeForm from '~/components/admin/organization/organization_type_form.vue'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseStat from '~/components/base/base_stat.vue'
import type { AdminOrganizationDetail } from '#shared/types/admin_organization'
import type { RoleType } from '#shared/types/role'

/**
 * `roles` : rôles d'organisation assignables (id + slug). Facultatif : sans lui, le
 * rôle des membres reste en lecture seule (le changement de rôle exige un `roleId`).
 */
const props = withDefaults(
  defineProps<{ organization: AdminOrganizationDetail; roles?: RoleType[] }>(),
  { roles: () => [] }
)

const { t, locale } = useI18n()
const { can } = usePlatformPermissions()

const indexUrl = computed(() => urlFor('admin.organizations.index', { locale: locale.value }))
const archived = computed(() => props.organization.archivedAt !== null)
const sells = computed(() => props.organization.organizationType !== 'buyer')
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
        <BaseBadge dot :tone="archived ? 'warning' : 'success'">
          {{
            t(
              archived ? 'admin.organizations.status.archived' : 'admin.organizations.status.active'
            )
          }}
        </BaseBadge>
        <BaseBadge tone="brand">
          {{ t(`admin.organizations.types.${organization.organizationType}`) }}
        </BaseBadge>
      </template>
    </BasePageHeader>

    <BaseAlert v-if="archived" tone="warning">
      {{ t('admin.organizations.detail.archivedNotice') }}
    </BaseAlert>

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

    <OrganizationOverview :organization="organization" :can-manage="organization.canManage" />

    <BaseSection v-if="organization.canManage" :title="t('admin.organizations.detail.info')">
      <OrganizationInfoForm :organization="organization" />
    </BaseSection>

    <BaseSection v-if="organization.canManage" :title="t('admin.organizations.detail.typeSection')">
      <OrganizationTypeForm
        :organization-id="organization.id"
        :organization-type="organization.organizationType"
      />
    </BaseSection>

    <OrganizationMembersSection
      :organization-id="organization.id"
      :members="organization.members"
      :roles="roles"
      :can-manage="organization.canManage"
    />

    <OrganizationInvitationsSection
      :organization-id="organization.id"
      :invitations="organization.pendingInvitations"
      :can-manage="organization.canManage"
    />

    <OrganizationSubscriptionSection
      v-if="sells"
      :organization-id="organization.id"
      :subscriptions="organization.subscriptions"
      :can-manage="organization.canManage"
    />

    <OrganizationProfilesSection :organization="organization" />

    <OrganizationConsentsSection
      v-if="can('audit.view')"
      :organization-id="organization.id"
      :organization-name="organization.name"
    />

    <BaseSection
      v-if="organization.canManage"
      :title="t('admin.organizations.detail.lifecycle.title')"
    >
      <OrganizationLifecycleActions :organization-id="organization.id" :archived="archived" />
    </BaseSection>
  </div>
</template>
