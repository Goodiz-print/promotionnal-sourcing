<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseInput from '~/components/base_input.vue'
import BaseButton from '~/components/base_button.vue'

const props = defineProps<{ redirect?: string | null }>()

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
  <div class="mx-auto flex max-w-[400px] flex-col justify-center">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('auth.login.title') }}</h1>
      <p class="mb-12 text-lg text-[var(--gray-6)]">
        {{ t('auth.login.subtitle') }}
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
      <BaseInput
        id="password"
        v-model="form.password"
        type="password"
        autocomplete="current-password"
        :label="t('auth.fields.password')"
        :error="form.errors.password"
      />
      <BaseButton type="submit" :disabled="form.processing">
        {{ t('auth.login.submit') }}
      </BaseButton>
    </form>
  </div>
</template>
