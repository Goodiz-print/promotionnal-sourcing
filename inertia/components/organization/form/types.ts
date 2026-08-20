import type { InjectionKey } from 'vue'
import type { InertiaForm } from '@inertiajs/vue3'
import type { OnboardingKind } from '#shared/types/organization'

/**
 * État du formulaire de création d'organisation (payload `useForm`) — identique
 * pour l'onboarding et pour une organisation supplémentaire : le slug est
 * dérivé du nom côté service, jamais saisi.
 */
export interface OrganizationFormState {
  name: string
  organizationType: OnboardingKind | null
}

/**
 * Formulaire partagé aux champs via provide/inject (et non en prop) : une
 * valeur injectée n'est pas un prop, sa mutation par le composant de champs est
 * donc légitime. Même pattern que `OrganizationSettingsFormKey`.
 */
export const OrganizationFormKey: InjectionKey<InertiaForm<OrganizationFormState>> =
  Symbol('organizationForm')
