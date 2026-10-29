<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSection from '~/components/base/base_section.vue'

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
  <form @submit.prevent="submit">
    <BaseSection as="fieldset" :title="t('account.password.title')">
      <div class="grid gap-5 sm:grid-cols-2">
        <BaseInput
          id="currentPassword"
          v-model="form.currentPassword"
          type="password"
          autocomplete="current-password"
          class="sm:col-span-2"
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
      </div>

      <template #footer>
        <div class="flex justify-end">
          <BaseButton type="submit" :loading="form.processing">
            {{ t('account.password.submit') }}
          </BaseButton>
        </div>
      </template>
    </BaseSection>
  </form>
</template>
