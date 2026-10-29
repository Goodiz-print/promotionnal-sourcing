<script setup lang="ts">
import { Head, useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import AuthHeader from '~/components/auth/auth_header.vue'
import AuthLayout from '~/layouts/auth.vue'
import { urlFor } from '~/client'
import BaseInput from '~/components/base/base_input.vue'
import BaseButton from '~/components/base/base_button.vue'

defineOptions({ layout: AuthLayout })

const { t, locale } = useI18n()

const form = useForm({ email: '' })

function submit() {
  form.post(urlFor('password.email', { locale: locale.value }))
}
</script>

<template>
  <Head :title="t('auth.forgot.title')" />

  <div class="flex flex-col gap-8">
    <AuthHeader :title="t('auth.forgot.title')" :description="t('auth.forgot.subtitle')" />

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <BaseInput
        id="email"
        v-model="form.email"
        type="email"
        autocomplete="username"
        :label="t('auth.fields.email')"
        :error="form.errors.email"
      />
      <BaseButton type="submit" block :loading="form.processing">
        {{ t('auth.forgot.submit') }}
      </BaseButton>
    </form>

    <Link
      class="text-body-sm font-semibold text-indigo-600 hover:underline"
      route="session.create"
      :params="{ locale }"
    >
      {{ t('auth.forgot.back') }}
    </Link>
  </div>
</template>
