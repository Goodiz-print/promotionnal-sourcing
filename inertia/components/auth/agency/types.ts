import type { InjectionKey } from 'vue'
import type { InertiaForm } from '@inertiajs/vue3'
import type { AgencyActivity, Civility } from '#shared/types/agency'
import type { Locale } from '#shared/types/i18n'

/**
 * État du formulaire d'inscription agence (payload `useForm`). Les chaînes vides
 * des champs facultatifs sont converties en `null` à l'envoi.
 */
export interface AgencySignupFormState {
  civility: Civility | ''
  firstName: string
  lastName: string
  email: string
  password: string
  passwordConfirmation: string
  companyName: string
  country: string
  taxId: string
  website: string
  phone: string
  activity: AgencyActivity | ''
  activityOther: string
  locale: Locale
  certifiesProfessional: boolean
  acceptsTerms: boolean
  acceptsPartnerCommunications: boolean
}

/** Formulaire partagé aux sections via provide/inject (cf. `OrganizationFormKey`). */
export const AgencySignupFormKey: InjectionKey<InertiaForm<AgencySignupFormState>> =
  Symbol('agencySignupForm')
