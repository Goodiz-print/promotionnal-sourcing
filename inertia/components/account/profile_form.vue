<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { AlertTriangle } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseField from '~/components/base/base_field.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSection from '~/components/base/base_section.vue'
import LanguageMenu from '~/components/language_menu.vue'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import type { AccountType } from '#shared/types/account'

const props = defineProps<{ account: AccountType }>()

const { t, locale } = useI18n()

const form = useForm<{ firstName: string; lastName: string; email: string; locale: Locale }>({
  firstName: props.account.firstName ?? '',
  lastName: props.account.lastName ?? '',
  email: props.account.email,
  locale: props.account.locale ?? DEFAULT_LOCALE,
})

function submit() {
  form
    .transform((data) => ({
      ...data,
      firstName: data.firstName.trim() || null,
      lastName: data.lastName.trim() || null,
    }))
    .patch(urlFor('account.update', { locale: locale.value }), { preserveScroll: true })
}
</script>

<template>
  <form @submit.prevent="submit">
    <BaseSection as="fieldset" :title="t('account.profile.title')">
      <div class="grid gap-5 sm:grid-cols-2">
        <BaseInput
          id="firstName"
          v-model="form.firstName"
          autocomplete="given-name"
          :label="t('auth.fields.firstName')"
          :error="form.errors.firstName"
        />
        <BaseInput
          id="lastName"
          v-model="form.lastName"
          autocomplete="family-name"
          :label="t('auth.fields.lastName')"
          :error="form.errors.lastName"
        />
        <div class="flex flex-col gap-1.5 sm:col-span-2">
          <BaseInput
            id="email"
            v-model="form.email"
            type="email"
            autocomplete="email"
            :label="t('auth.fields.email')"
            :error="form.errors.email"
          />
          <p
            v-if="!account.isEmailVerified"
            class="flex items-center gap-1.5 text-caption font-medium text-warning"
          >
            <AlertTriangle :size="14" aria-hidden="true" />
            {{ t('account.profile.unverified') }}
          </p>
        </div>
        <BaseField :label="t('account.profile.language')" :error="form.errors.locale">
          <LanguageMenu
            :current="form.locale"
            :locales="SUPPORTED_LOCALES"
            :label="t('account.profile.language')"
            button-class="h-11 rounded-md border border-input bg-canvas px-3.5 text-body-sm font-semibold text-text-primary transition-colors duration-150 hover:border-strong"
            @select="form.locale = $event"
          />
        </BaseField>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <BaseButton type="submit" :loading="form.processing">
            {{ t('account.profile.submit') }}
          </BaseButton>
        </div>
      </template>
    </BaseSection>
  </form>
</template>
