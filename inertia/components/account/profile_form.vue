<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseInput from '~/components/base/base_input.vue'
import LanguageMenu from '~/components/language_menu.vue'
import BaseButton from '~/components/base/base_button.vue'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import type { AccountType } from '#shared/types/account'

const props = defineProps<{ account: AccountType }>()

const { t, locale } = useI18n()

const form = useForm<{ fullName: string; email: string; locale: Locale }>({
  fullName: props.account.fullName ?? '',
  email: props.account.email,
  locale: props.account.locale ?? DEFAULT_LOCALE,
})

function submit() {
  form
    .transform((data) => ({ ...data, fullName: data.fullName.trim() || null }))
    .patch(urlFor('account.update', { locale: locale.value }), { preserveScroll: true })
}
</script>

<template>
  <section>
    <h2 class="mb-4 text-lg font-medium">{{ t('account.profile.title') }}</h2>
    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <BaseInput
        id="fullName"
        v-model="form.fullName"
        autocomplete="name"
        :label="t('auth.fields.fullName')"
        :error="form.errors.fullName"
      />
      <div>
        <BaseInput
          id="email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          :label="t('auth.fields.email')"
          :error="form.errors.email"
        />
        <p v-if="!account.isEmailVerified" class="mt-1 text-sm text-[var(--state-danger)]">
          {{ t('account.profile.unverified') }}
        </p>
      </div>
      <div>
        <p class="mb-1.5 text-sm font-medium text-[var(--gray-10)]">
          {{ t('account.profile.language') }}
        </p>
        <LanguageMenu
          :current="form.locale"
          :locales="SUPPORTED_LOCALES"
          :label="t('account.profile.language')"
          button-class="rounded border border-[var(--gray-4)] bg-white px-3 py-2 text-sm font-medium"
          @select="form.locale = $event"
        />
        <p v-if="form.errors.locale" class="mt-1 text-sm text-[var(--state-danger)]">
          {{ form.errors.locale }}
        </p>
      </div>
      <BaseButton type="submit" :disabled="form.processing">
        {{ t('account.profile.submit') }}
      </BaseButton>
    </form>
  </section>
</template>
