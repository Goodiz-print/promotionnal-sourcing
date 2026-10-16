<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseInput from '~/components/base_input.vue'
import BaseButton from '~/components/base_button.vue'

const { t, locale } = useI18n()

const form = useForm({ currentPassword: '', password: '', passwordConfirmation: '' })

function submit() {
  form.patch(urlFor('account.password.update', { locale: locale.value }), {
    preserveScroll: true,
    onSuccess: () => form.reset(),
  })
}
</script>

<template>
  <section>
    <h2 class="mb-4 text-lg font-medium">{{ t('account.password.title') }}</h2>
    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <BaseInput
        id="currentPassword"
        v-model="form.currentPassword"
        type="password"
        autocomplete="current-password"
        :label="t('account.password.current')"
        :error="form.errors.currentPassword"
      />
      <BaseInput
        id="newPassword"
        v-model="form.password"
        type="password"
        autocomplete="new-password"
        :label="t('account.password.new')"
        :error="form.errors.password"
      />
      <BaseInput
        id="newPasswordConfirmation"
        v-model="form.passwordConfirmation"
        type="password"
        autocomplete="new-password"
        :label="t('account.password.confirm')"
        :error="form.errors.passwordConfirmation"
      />
      <BaseButton type="submit" :disabled="form.processing">
        {{ t('account.password.submit') }}
      </BaseButton>
    </form>
  </section>
</template>
