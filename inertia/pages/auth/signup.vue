<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseInput from '~/components/base/base_input.vue'
import BaseButton from '~/components/base/base_button.vue'

const props = defineProps<{ redirect?: string | null; email?: string | null }>()

const { t, locale } = useI18n()

const form = useForm({
  firstName: '',
  lastName: '',
  email: props.email ?? '',
  password: '',
  passwordConfirmation: '',
})

function submit() {
  const target = urlFor('new_account.store', { locale: locale.value })
  form.post(props.redirect ? `${target}?redirect=${encodeURIComponent(props.redirect)}` : target)
}
</script>

<template>
  <div class="mx-auto flex max-w-[400px] flex-col justify-center">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('auth.signup.title') }}</h1>
      <p class="mb-12 text-lg text-[var(--gray-6)]">
        {{ t('auth.signup.subtitle') }}
      </p>
    </div>

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <BaseInput
        id="firstName"
        v-model="form.firstName"
        type="text"
        autocomplete="given-name"
        :label="t('auth.fields.firstName')"
        :error="form.errors.firstName"
      />
      <BaseInput
        id="lastName"
        v-model="form.lastName"
        type="text"
        autocomplete="family-name"
        :label="t('auth.fields.lastName')"
        :error="form.errors.lastName"
      />
      <BaseInput
        id="email"
        v-model="form.email"
        type="email"
        autocomplete="email"
        :label="t('auth.fields.email')"
        :error="form.errors.email"
      />
      <BaseInput
        id="password"
        v-model="form.password"
        type="password"
        autocomplete="new-password"
        :label="t('auth.fields.password')"
        :error="form.errors.password"
      />
      <BaseInput
        id="passwordConfirmation"
        v-model="form.passwordConfirmation"
        type="password"
        autocomplete="new-password"
        :label="t('auth.fields.passwordConfirmation')"
        :error="form.errors.passwordConfirmation"
      />
      <BaseButton type="submit" :disabled="form.processing">
        {{ t('auth.signup.submit') }}
      </BaseButton>
    </form>
  </div>
</template>
