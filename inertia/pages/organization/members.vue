<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import SectionNav from '~/components/organization/section_nav.vue'
import MembersTable from '~/components/organization/members/members_table.vue'
import InviteForm from '~/components/organization/members/invite_form.vue'
import PendingInvitations from '~/components/organization/members/pending_invitations.vue'
import type { OrganizationMemberType, OrganizationInvitationType } from '#shared/types/organization'
import type { RoleType } from '#shared/types/role'

const props = defineProps<{
  members: OrganizationMemberType[]
  invitations: OrganizationInvitationType[]
  roles: RoleType[]
  canManageMembers: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <Head :title="t('organization.members.title')" />

  <div class="mx-auto flex max-w-[720px] flex-col justify-center gap-8 px-6 py-12">
    <SectionNav current="members" />

    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('organization.members.title') }}</h1>
      <p class="text-lg text-[var(--gray-6)]">{{ t('organization.members.subtitle') }}</p>
    </div>

    <MembersTable
      :members="props.members"
      :roles="props.roles"
      :can-manage="props.canManageMembers"
    />

    <div>
      <h2 class="mb-3 font-medium">{{ t('organization.invitations.inviteTitle') }}</h2>
      <InviteForm :roles="props.roles" />
    </div>

    <PendingInvitations :invitations="props.invitations" />
  </div>
</template>
