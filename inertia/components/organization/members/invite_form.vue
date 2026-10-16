<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseButton from '~/components/base/base_button.vue'
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
  <form class="flex items-end gap-3" @submit.prevent="submit">
    <BaseInput
      id="invite-email"
      v-model="form.email"
      type="email"
      class="flex-1"
      :label="t('organization.invitations.emailLabel')"
      :error="form.errors.email"
    />
    <BaseSelect
      id="invite-role"
      v-model="form.roleId"
      class="w-48"
      :label="t('organization.invitations.roleLabel')"
      :error="form.errors.roleId"
    >
      <option v-for="role in props.roles" :key="role.id" :value="String(role.id)">
        {{ role.name }}
      </option>
    </BaseSelect>
    <BaseButton type="submit" :disabled="form.processing">
      {{ t('organization.invitations.submit') }}
    </BaseButton>
  </form>
</template>
