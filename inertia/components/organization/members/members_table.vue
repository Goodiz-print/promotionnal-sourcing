<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base_button.vue'
import BaseSelect from '~/components/base_select.vue'
import type { OrganizationMemberType } from '#shared/types/organization'
import type { RoleType } from '#shared/types/role'

const props = defineProps<{
  members: OrganizationMemberType[]
  roles: RoleType[]
  canManage: boolean
}>()

const { t, locale } = useI18n()

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
  <table class="w-full border-collapse text-sm">
    <thead>
      <tr class="border-b border-[var(--gray-4)] text-left text-[var(--gray-6)]">
        <th class="py-2 pr-4 font-medium">{{ t('organization.members.columns.name') }}</th>
        <th class="py-2 pr-4 font-medium">{{ t('organization.members.columns.role') }}</th>
        <th class="py-2"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="member in props.members" :key="member.id" class="border-b border-[var(--gray-3)]">
        <td class="py-3 pr-4">
          <div class="font-medium">{{ member.fullName ?? member.email }}</div>
          <div class="text-[var(--gray-6)]">{{ member.email }}</div>
        </td>
        <td class="w-48 py-3 pr-4">
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
          <span v-else>{{ member.role.name }}</span>
        </td>
        <td class="py-3 text-right">
          <BaseButton v-if="canManage" variant="secondary" @click="removeMember(member)">
            {{ t('organization.members.remove') }}
          </BaseButton>
        </td>
      </tr>
    </tbody>
  </table>
</template>
