<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseAvatar from '~/components/base/base_avatar.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { OrganizationMemberType } from '#shared/types/organization'
import type { RoleType } from '#shared/types/role'

const props = defineProps<{
  members: OrganizationMemberType[]
  roles: RoleType[]
  canManage: boolean
}>()

const { t, locale } = useI18n()

/** Initiales de l'avatar : deux premières du nom, sinon le début de l'e-mail. */
function initials(member: OrganizationMemberType): string {
  if (!member.fullName) return member.email.slice(0, 2)
  return member.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
}

function changeRole(member: OrganizationMemberType, roleId: string) {
  router.patch(
    urlFor('organization.members.update', { locale: locale.value, id: member.id }),
    { roleId: Number(roleId) },
    { preserveScroll: true }
  )
}

function removeMember(member: OrganizationMemberType) {
  if (!window.confirm(t('organization.members.confirmRemove'))) return
  router.delete(urlFor('organization.members.destroy', { locale: locale.value, id: member.id }), {
    preserveScroll: true,
  })
}
</script>

<template>
  <BaseSection flush :title="t('organization.members.listTitle')">
    <template #actions>
      <BaseBadge tone="neutral">{{ props.members.length }}</BaseBadge>
    </template>

    <BaseTable bare>
      <template #head>
        <tr>
          <th scope="col">{{ t('organization.members.columns.name') }}</th>
          <th scope="col">{{ t('organization.members.columns.role') }}</th>
          <th v-if="canManage" scope="col">
            <span class="sr-only">{{ t('organization.members.columns.actions') }}</span>
          </th>
        </tr>
      </template>

      <tr v-for="member in props.members" :key="member.id">
        <td>
          <div class="flex items-center gap-3">
            <BaseAvatar :initials="initials(member)" size="sm" />
            <div class="flex min-w-0 flex-col">
              <span class="truncate font-semibold text-text-primary">
                {{ member.fullName ?? member.email }}
              </span>
              <span class="truncate text-caption text-text-secondary">{{ member.email }}</span>
            </div>
          </div>
        </td>
        <td class="w-52">
          <BaseSelect
            v-if="canManage"
            :id="`role-${member.id}`"
            :model-value="String(member.role.id)"
            @update:model-value="(value) => changeRole(member, value)"
          >
            <option v-for="role in props.roles" :key="role.id" :value="String(role.id)">
              {{ role.name }}
            </option>
          </BaseSelect>
          <BaseBadge v-else tone="neutral">{{ member.role.name }}</BaseBadge>
        </td>
        <td v-if="canManage" class="text-right">
          <BaseButton variant="danger" size="sm" @click="removeMember(member)">
            {{ t('organization.members.remove') }}
          </BaseButton>
        </td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
