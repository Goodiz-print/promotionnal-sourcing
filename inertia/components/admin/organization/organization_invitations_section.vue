<script setup lang="ts">
import { Mail, RotateCw, X } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useAdminOrganizationActions } from '~/composables/use_admin_organization_actions'
import BaseButton from '~/components/base/base_button.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import { ICON_SIZE } from '~/types/ui'
import type { AdminOrganizationInvitation } from '#shared/types/admin_organization'

/** Invitations en attente : révocation (DELETE) et renvoi (POST) si `canManage`. */
const props = defineProps<{
  organizationId: number
  invitations: AdminOrganizationInvitation[]
  canManage: boolean
}>()

const { t, locale } = useI18n()
const { processing, revokeInvitation, resendInvitation } = useAdminOrganizationActions(
  props.organizationId
)

const formatDate = (value: string) => new Date(value).toLocaleDateString(locale.value)

const inviter = (invitation: AdminOrganizationInvitation) =>
  invitation.invitedByName || invitation.invitedByEmail

function resend(invitation: AdminOrganizationInvitation) {
  resendInvitation(invitation.id, {
    message: t('admin.organizations.detail.invitation.resendConfirm', { email: invitation.email }),
    confirmLabel: t('admin.organizations.detail.invitation.resend'),
  })
}

function revoke(invitation: AdminOrganizationInvitation) {
  revokeInvitation(invitation.id, {
    message: t('admin.organizations.detail.invitation.revokeConfirm', { email: invitation.email }),
    confirmLabel: t('admin.organizations.detail.invitation.revoke'),
    tone: 'danger',
  })
}
</script>

<template>
  <BaseSection :title="t('admin.organizations.detail.invitation.title')" flush>
    <div v-if="invitations.length === 0" class="p-6">
      <BaseEmptyState
        :title="t('admin.organizations.detail.invitation.empty')"
        :icon="Mail"
        compact
      />
    </div>

    <BaseTable v-else bare :caption="t('admin.organizations.detail.invitation.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.users.columns.email') }}</th>
          <th scope="col">{{ t('admin.organizations.detail.role') }}</th>
          <th scope="col">{{ t('admin.organizations.detail.invitation.expiresAt') }}</th>
          <th scope="col">{{ t('admin.organizations.detail.invitation.invitedBy') }}</th>
          <th v-if="canManage" scope="col">
            <span class="sr-only">{{ t('admin.organizations.detail.member.actions') }}</span>
          </th>
        </tr>
      </template>

      <tr v-for="invitation in invitations" :key="invitation.id">
        <td class="font-semibold text-text-primary">{{ invitation.email }}</td>
        <td>{{ t(`admin.organizations.roles.${invitation.roleSlug}`) }}</td>
        <td class="text-tabular whitespace-nowrap">{{ formatDate(invitation.expiresAt) }}</td>
        <td class="text-text-secondary">
          {{ inviter(invitation) ?? t('admin.organizations.detail.notProvided') }}
        </td>
        <td v-if="canManage">
          <div class="flex justify-end gap-2">
            <BaseButton
              variant="secondary"
              size="sm"
              :disabled="processing"
              @click="resend(invitation)"
            >
              <template #icon><RotateCw :size="ICON_SIZE" aria-hidden="true" /></template>
              {{ t('admin.organizations.detail.invitation.resend') }}
            </BaseButton>
            <BaseButton
              variant="danger"
              size="sm"
              :disabled="processing"
              @click="revoke(invitation)"
            >
              <template #icon><X :size="ICON_SIZE" aria-hidden="true" /></template>
              {{ t('admin.organizations.detail.invitation.revoke') }}
            </BaseButton>
          </div>
        </td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
