<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseInput from '~/components/base_input.vue'
import BaseSelect from '~/components/base_select.vue'
import BaseButton from '~/components/base_button.vue'
import { LOCALE_LABELS, SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
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
      <BaseSelect
        id="locale"
        v-model="form.locale"
        :label="t('account.profile.language')"
        :error="form.errors.locale"
      >
        <option v-for="code in SUPPORTED_LOCALES" :key="code" :value="code">
          {{ LOCALE_LABELS[code] }}
        </option>
      </BaseSelect>
      <BaseButton type="submit" :disabled="form.processing">
        {{ t('account.profile.submit') }}
      </BaseButton>
    </form>
  </section>
</template>
