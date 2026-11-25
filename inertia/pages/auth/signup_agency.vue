<script setup lang="ts">
import { provide } from 'vue'
import { Head, useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import AuthHeader from '~/components/auth/auth_header.vue'
import AuthLayout from '~/layouts/auth.vue'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import AccountSection from '~/components/auth/agency/account_section.vue'
import CompanySection from '~/components/auth/agency/company_section.vue'
import ConsentSection from '~/components/auth/agency/consent_section.vue'
import { AgencySignupFormKey, type AgencySignupFormState } from '~/components/auth/agency/types'
import { defaultLocaleForCountry } from '#shared/types/country'
import type { Locale } from '#shared/types/i18n'

const props = defineProps<{ redirect?: string | null }>()

defineOptions({ layout: AuthLayout })

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
  contactEmail: '',
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
      contactEmail: data.contactEmail.trim() || null,
      activityOther: data.activity === 'other' ? data.activityOther.trim() || null : null,
      locale: data.locale || defaultLocaleForCountry(data.country),
    }))
    .post(props.redirect ? `${target}?redirect=${encodeURIComponent(props.redirect)}` : target)
}
</script>

<template>
  <Head :title="t('agency_signup.title')" />

  <div class="flex flex-col gap-8">
    <AuthHeader :title="t('agency_signup.title')" :description="t('agency_signup.subtitle')" />

    <form class="flex flex-col gap-10" @submit.prevent="submit">
      <AccountSection />
      <CompanySection />
      <ConsentSection />
      <BaseButton type="submit" block :loading="form.processing">
        {{ t('agency_signup.submit') }}
      </BaseButton>
    </form>

    <p class="text-body-sm text-text-secondary">
      <Link
        route="session.create"
        :params="{ locale }"
        class="font-semibold text-indigo-600 hover:underline"
      >
        {{ t('agency_signup.haveAccount') }}
      </Link>
    </p>
  </div>
</template>
