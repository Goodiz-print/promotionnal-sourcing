<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import type { OrganizationInvitationType } from '#shared/types/organization'

const props = defineProps<{ invitations: OrganizationInvitationType[] }>()

const { t, locale } = useI18n()

function resend(invitation: OrganizationInvitationType) {
  router.post(
    urlFor('organization.invitations.resend', { locale: locale.value, id: invitation.id }),
    {},
    { preserveScroll: true }
  )
}

function revoke(invitation: OrganizationInvitationType) {
  if (!window.confirm(t('organization.invitations.confirmRevoke'))) return
  router.delete(
    urlFor('organization.invitations.destroy', { locale: locale.value, id: invitation.id }),
    { preserveScroll: true }
  )
}
</script>

<template>
  <div v-if="props.invitations.length > 0">
    <h2 class="mb-3 font-medium">{{ t('organization.invitations.pendingTitle') }}</h2>
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-[var(--gray-4)] text-left text-[var(--gray-6)]">
          <th class="py-2 pr-4 font-medium">{{ t('organization.members.columns.name') }}</th>
          <th class="py-2 pr-4 font-medium">{{ t('organization.members.columns.role') }}</th>
          <th class="py-2"></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="invitation in props.invitations"
          :key="invitation.id"
          class="border-b border-[var(--gray-3)]"
        >
          <td class="py-3 pr-4">{{ invitation.email }}</td>
          <td class="py-3 pr-4">{{ invitation.role.name }}</td>
          <td class="py-3 text-right">
            <div class="flex justify-end gap-2">
              <BaseButton variant="secondary" @click="resend(invitation)">
                {{ t('organization.invitations.resend') }}
              </BaseButton>
              <BaseButton variant="secondary" @click="revoke(invitation)">
                {{ t('organization.invitations.revoke') }}
              </BaseButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
