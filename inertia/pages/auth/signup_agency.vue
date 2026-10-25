<script setup lang="ts">
import { provide } from 'vue'
import { Head, useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import AccountSection from '~/components/auth/agency/account_section.vue'
import CompanySection from '~/components/auth/agency/company_section.vue'
import ConsentSection from '~/components/auth/agency/consent_section.vue'
import { AgencySignupFormKey, type AgencySignupFormState } from '~/components/auth/agency/types'
import { defaultLocaleForCountry } from '#shared/types/country'
import type { Locale } from '#shared/types/i18n'

const props = defineProps<{ redirect?: string | null }>()

const { t, locale } = useI18n()

const form = useForm<AgencySignupFormState>({
  civility: '',
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  passwordConfirmation: '',
  companyName: '',
  country: '',
  taxId: '',
  website: '',
  phone: '',
  activity: '',
  activityOther: '',
  locale: locale.value as Locale,
  certifiesProfessional: false,
  acceptsTerms: false,
  acceptsPartnerCommunications: false,
})

provide(AgencySignupFormKey, form)

/** Les champs facultatifs vides partent en `null` ; le reste est envoyé tel quel. */
function submit() {
  const target = urlFor('agency_signup.store', { locale: locale.value })
  form
    .transform((data) => ({
      ...data,
      civility: data.civility || null,
      website: data.website.trim() || null,
      phone: data.phone.trim() || null,
      activityOther: data.activity === 'other' ? data.activityOther.trim() || null : null,
      locale: data.locale || defaultLocaleForCountry(data.country),
    }))
    .post(props.redirect ? `${target}?redirect=${encodeURIComponent(props.redirect)}` : target)
}
</script>

<template>
  <Head :title="t('agency_signup.title')" />

  <div class="mx-auto flex max-w-[520px] flex-col justify-center">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('agency_signup.title') }}</h1>
      <p class="mb-12 text-lg text-[var(--gray-6)]">{{ t('agency_signup.subtitle') }}</p>
    </div>

    <form class="flex flex-col gap-10" @submit.prevent="submit">
      <AccountSection />
      <CompanySection />
      <ConsentSection />
      <BaseButton type="submit" :disabled="form.processing">
        {{ t('agency_signup.submit') }}
      </BaseButton>
    </form>

    <p class="mt-6 text-sm text-[var(--gray-6)]">
      <Link route="session.create" :params="{ locale }" class="underline">
        {{ t('agency_signup.haveAccount') }}
      </Link>
    </p>
  </div>
</template>
