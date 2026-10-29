<script setup lang="ts">
import { Head, useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import AuthHeader from '~/components/auth/auth_header.vue'
import AuthLayout from '~/layouts/auth.vue'
import { urlFor } from '~/client'
import BaseInput from '~/components/base/base_input.vue'
import BaseButton from '~/components/base/base_button.vue'
import PasskeyLogin from '~/components/auth/passkey_login.vue'

const props = defineProps<{ redirect?: string | null }>()

defineOptions({ layout: AuthLayout })

const { t, locale } = useI18n()

const form = useForm({
  email: '',
  password: '',
})

function submit() {
  const target = urlFor('session.store', { locale: locale.value })
  form.post(props.redirect ? `${target}?redirect=${encodeURIComponent(props.redirect)}` : target)
}
</script>

<template>
  <Head :title="t('auth.login.title')" />

  <div class="flex flex-col gap-8">
    <AuthHeader :title="t('auth.login.title')" :description="t('auth.login.subtitle')" />

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <BaseInput
        id="email"
        v-model="form.email"
        type="email"
        autocomplete="username"
        :label="t('auth.fields.email')"
        :error="form.errors.email"
      />
      <BaseInput
        id="password"
        v-model="form.password"
        type="password"
        autocomplete="current-password"
        :label="t('auth.fields.password')"
        :error="form.errors.password"
      />
      <BaseButton type="submit" block :loading="form.processing">
        {{ t('auth.login.submit') }}
      </BaseButton>
    </form>

    <div>
      <PasskeyLogin :redirect="props.redirect" />
    </div>

    <Link
      class="text-body-sm font-semibold text-indigo-600 hover:underline"
      route="password.forgot"
      :params="{ locale }"
    >
      {{ t('auth.login.forgot') }}
    </Link>
  </div>
</template>
