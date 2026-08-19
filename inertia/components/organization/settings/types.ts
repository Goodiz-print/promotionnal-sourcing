import type { InjectionKey } from 'vue'
import type { InertiaForm } from '@inertiajs/vue3'
import type { OrganizationSize } from '#shared/types/organization'

/**
 * État du formulaire "paramètres de l'organisation" (payload `useForm`).
 * `logo` porte un nouveau fichier choisi (ou `null`), `removeLogo` demande la
 * suppression du logo courant sans en uploader un nouveau.
 */
export interface OrganizationSettingsFormState {
  name: string
  siret: string
  vatNumber: string
  email: string
  phone: string
  website: string
  industry: string
  size: OrganizationSize | null
  description: string
  addressLine1: string
  addressLine2: string
  city: string
  postalCode: string
  country: string
  logo: File | null
  removeLogo: boolean
}

/**
 * Le formulaire est partagé aux sections via provide/inject (et non en prop) :
 * une valeur injectée n'est pas un prop, donc sa mutation par les sections est
 * légitime (pas de `vue/no-mutating-props`).
 */
export const OrganizationSettingsFormKey: InjectionKey<InertiaForm<OrganizationSettingsFormState>> =
  Symbol('organizationSettingsForm')
