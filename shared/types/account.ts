import type { Locale } from '#shared/types/i18n'

/** Champs modifiables de la page « mon compte » (nom, email, langue). */
export interface UpdateAccountData {
  fullName: string | null
  email: string
  locale: Locale
}

/**
 * Compte tel qu'affiché sur la page « mon compte ». Défini en `type` (et non
 * `interface`) : DTO de page Inertia, il doit rester assignable à
 * `Record<string, JSONDataTypes>` (cf. `OrganizationType`).
 */
export type AccountType = {
  fullName: string | null
  email: string
  locale: Locale | null
  isEmailVerified: boolean
}

/** Domaine de l'adresse attribuée à un compte anonymisé (TLD `.invalid`, RFC 2606). */
export const ANONYMIZED_EMAIL_DOMAIN = 'anonymized.invalid'
