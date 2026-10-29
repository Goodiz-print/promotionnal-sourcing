<script setup lang="ts">
import { Head, useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import AuthLayout from '~/layouts/auth.vue'
import { urlFor } from '~/client'
import BaseInput from '~/components/base/base_input.vue'
import BaseButton from '~/components/base/base_button.vue'

const props = defineProps<{ redirect?: string | null; email?: string | null }>()

defineOptions({ layout: AuthLayout })

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
  <Head :title="t('auth.signup.title')" />

  <div class="flex flex-col gap-8">
    <div class="flex flex-col gap-2">
      <h1 class="text-display-md">{{ t('auth.signup.title') }}</h1>
      <p class="text-body-md text-text-secondary">
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
      <BaseButton type="submit" block :loading="form.processing">
        {{ t('auth.signup.submit') }}
      </BaseButton>
    </form>

    <p class="text-body-sm text-text-secondary">
      <Link
        route="agency_signup.create"
        :params="{ locale }"
        class="font-semibold text-indigo-600 hover:underline"
      >
        {{ t('auth.signup.agencyLink') }}
      </Link>
    </p>
  </div>
</template>
