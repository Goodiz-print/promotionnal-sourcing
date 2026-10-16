<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseInput from '~/components/base/base_input.vue'
import BaseButton from '~/components/base/base_button.vue'

const { t, locale } = useI18n()

const form = useForm({ email: '' })

function submit() {
  form.post(urlFor('password.email', { locale: locale.value }))
}
</script>

<template>
  <div class="mx-auto flex max-w-[400px] flex-col justify-center">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('auth.forgot.title') }}</h1>
      <p class="mb-12 text-lg text-[var(--gray-6)]">
        {{ t('auth.forgot.subtitle') }}
      </p>
    </div>

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <BaseInput
        id="email"
        v-model="form.email"
        type="email"
        autocomplete="username"
        :label="t('auth.fields.email')"
        :error="form.errors.email"
      />
      <BaseButton type="submit" :disabled="form.processing">
        {{ t('auth.forgot.submit') }}
      </BaseButton>
    </form>

    <Link class="mt-6 text-sm underline" route="session.create" :params="{ locale }">
      {{ t('auth.forgot.back') }}
    </Link>
  </div>
</template>
