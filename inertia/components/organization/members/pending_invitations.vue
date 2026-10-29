<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { Mail } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
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
  <BaseSection
    v-if="props.invitations.length > 0"
    flush
    :title="t('organization.invitations.pendingTitle')"
  >
    <template #actions>
      <BaseBadge tone="warning">{{ props.invitations.length }}</BaseBadge>
    </template>

    <BaseTable bare>
      <template #head>
        <tr>
          <th scope="col">{{ t('organization.members.columns.name') }}</th>
          <th scope="col">{{ t('organization.members.columns.role') }}</th>
          <th scope="col">
            <span class="sr-only">{{ t('organization.members.columns.actions') }}</span>
          </th>
        </tr>
      </template>

      <tr v-for="invitation in props.invitations" :key="invitation.id">
        <td>
          <div class="flex items-center gap-3">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-subtle text-indigo-600"
              aria-hidden="true"
            >
              <Mail :size="16" />
            </span>
            <span class="truncate font-semibold text-text-primary">{{ invitation.email }}</span>
          </div>
        </td>
        <td>
          <BaseBadge tone="neutral">{{ invitation.role.name }}</BaseBadge>
        </td>
        <td class="text-right">
          <div class="flex justify-end gap-2">
            <BaseButton variant="secondary" size="sm" @click="resend(invitation)">
              {{ t('organization.invitations.resend') }}
            </BaseButton>
            <BaseButton variant="danger" size="sm" @click="revoke(invitation)">
              {{ t('organization.invitations.revoke') }}
            </BaseButton>
          </div>
        </td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
