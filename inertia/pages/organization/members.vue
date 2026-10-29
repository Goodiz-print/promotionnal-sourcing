<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Plus } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useOrganizationTabs } from '~/composables/use_organization_tabs'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseTabs from '~/components/base/base_tabs.vue'
import MembersTable from '~/components/organization/members/members_table.vue'
import InviteForm from '~/components/organization/members/invite_form.vue'
import PendingInvitations from '~/components/organization/members/pending_invitations.vue'
import type { OrganizationMemberType, OrganizationInvitationType } from '#shared/types/organization'
import type { RoleType } from '#shared/types/role'

defineProps<{
  members: OrganizationMemberType[]
  invitations: OrganizationInvitationType[]
  roles: RoleType[]
  canManageMembers: boolean
}>()

const { t } = useI18n()
const { items: tabs, label: tabsLabel, createHref, createLabel } = useOrganizationTabs()
</script>

<template>
  <Head :title="t('organization.members.title')" />

  <div class="flex w-full flex-col gap-8">
    <BasePageHeader
      :title="t('organization.members.title')"
      :description="t('organization.members.subtitle')"
    />

    <BaseTabs :items="tabs" :label="tabsLabel">
      <template #actions>
        <BaseLinkButton :href="createHref" variant="ghost" size="sm">
          <Plus :size="16" aria-hidden="true" />
          {{ createLabel }}
        </BaseLinkButton>
      </template>
    </BaseTabs>

    <MembersTable :members="members" :roles="roles" :can-manage="canManageMembers" />

    <InviteForm :roles="roles" />

    <PendingInvitations :invitations="invitations" />
  </div>
</template>
