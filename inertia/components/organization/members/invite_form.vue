<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { Send } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { ICON_SIZE } from '~/types/ui'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseSelect from '~/components/base/base_select.vue'
import type { RoleType } from '#shared/types/role'

const props = defineProps<{ roles: RoleType[] }>()

const { t, locale } = useI18n()

const form = useForm({
  email: '',
  roleId: props.roles[0] ? String(props.roles[0].id) : '',
})

function submit() {
  form
    .transform((data) => ({ email: data.email, roleId: Number(data.roleId) }))
    .post(urlFor('organization.invitations.store', { locale: locale.value }), {
      preserveScroll: true,
      onSuccess: () => form.reset('email'),
    })
}
</script>

<template>
  <form @submit.prevent="submit">
    <BaseSection as="fieldset" :title="t('organization.invitations.inviteTitle')">
      <div class="grid gap-5 sm:grid-cols-2">
        <BaseInput
          id="invite-email"
          v-model="form.email"
          type="email"
          :label="t('organization.invitations.emailLabel')"
          :error="form.errors.email"
        />
        <BaseSelect
          id="invite-role"
          v-model="form.roleId"
          :label="t('organization.invitations.roleLabel')"
          :error="form.errors.roleId"
        >
          <option v-for="role in props.roles" :key="role.id" :value="String(role.id)">
            {{ role.name }}
          </option>
        </BaseSelect>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <BaseButton type="submit" :loading="form.processing">
            <template #icon><Send :size="ICON_SIZE" aria-hidden="true" /></template>
            {{ t('organization.invitations.submit') }}
          </BaseButton>
        </div>
      </template>
    </BaseSection>
  </form>
</template>
