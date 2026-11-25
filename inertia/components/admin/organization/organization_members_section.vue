<script setup lang="ts">
import { computed } from 'vue'
import { Trash2, Users } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useAdminOrganizationActions } from '~/composables/use_admin_organization_actions'
import { ORGANIZATION_ROLE_TONES } from '~/components/admin/types'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminOrganizationMember } from '#shared/types/admin_organization'
import type { RoleType } from '#shared/types/role'

/**
 * Membres d'une organisation. Avec `canManage` et la liste des rôles (`roles`),
 * le rôle se change par un select (PATCH) et un membre se retire (DELETE, avec
 * confirmation). Sans la liste des rôles, le rôle reste en lecture seule.
 */
const props = defineProps<{
  organizationId: number
  members: AdminOrganizationMember[]
  roles: RoleType[]
  canManage: boolean
}>()

const { t, locale } = useI18n()
const { processing, changeMemberRole, removeMember } = useAdminOrganizationActions(
  props.organizationId
)

const canEditRole = computed(() => props.canManage && props.roles.length > 0)

const roleIdOf = (member: AdminOrganizationMember) =>
  props.roles.find((role) => role.slug === member.roleSlug)?.id ?? 0

const displayName = (member: AdminOrganizationMember) => member.fullName || member.email

const formatDate = (value: string) => new Date(value).toLocaleDateString(locale.value)

function remove(member: AdminOrganizationMember) {
  removeMember(member.membershipId, {
    message: t('admin.organizations.detail.member.removeConfirm', { name: displayName(member) }),
    confirmLabel: t('admin.organizations.detail.member.remove'),
    tone: 'danger',
  })
}
</script>

<template>
  <BaseSection :title="t('admin.organizations.detail.members', { count: members.length })" flush>
    <div v-if="members.length === 0" class="p-6">
      <BaseEmptyState :title="t('admin.organizations.detail.membersEmpty')" :icon="Users" compact />
    </div>

    <BaseTable v-else bare :caption="t('admin.organizations.detail.membersCaption')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.users.columns.name') }}</th>
          <th scope="col">{{ t('admin.users.columns.email') }}</th>
          <th scope="col">{{ t('admin.organizations.detail.role') }}</th>
          <th scope="col">{{ t('admin.organizations.detail.joinedAt') }}</th>
          <th v-if="canManage" scope="col">
            <span class="sr-only">{{ t('admin.organizations.detail.member.actions') }}</span>
          </th>
        </tr>
      </template>

      <tr v-for="member in members" :key="member.membershipId">
        <td>
          <span v-if="member.fullName" class="font-semibold text-text-primary">
            {{ member.fullName }}
          </span>
          <span v-else class="text-text-muted">{{ t('admin.users.noName') }}</span>
        </td>
        <td class="text-text-secondary">{{ member.email }}</td>
        <td :class="canEditRole ? 'w-56' : ''">
          <BaseSelect
            v-if="canEditRole"
            :id="`member-role-${member.membershipId}`"
            :model-value="roleIdOf(member)"
            :disabled="processing"
            :aria-label="
              t('admin.organizations.detail.member.roleLabel', { name: displayName(member) })
            "
            @update:model-value="(roleId) => changeMemberRole(member.membershipId, roleId)"
          >
            <option v-for="role in roles" :key="role.id" :value="role.id">
              {{ t(`admin.organizations.roles.${role.slug}`) }}
            </option>
          </BaseSelect>
          <BaseBadge v-else dot :tone="ORGANIZATION_ROLE_TONES[member.roleSlug]">
            {{ t(`admin.organizations.roles.${member.roleSlug}`) }}
          </BaseBadge>
        </td>
        <td class="text-tabular whitespace-nowrap">{{ formatDate(member.joinedAt) }}</td>
        <td v-if="canManage" class="text-right">
          <BaseIconButton
            :label="t('admin.organizations.detail.member.remove')"
            :disabled="processing"
            @click="remove(member)"
          >
            <Trash2 :size="16" aria-hidden="true" />
          </BaseIconButton>
        </td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
