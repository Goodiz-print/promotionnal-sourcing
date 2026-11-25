import type { AgencyActivity, Civility } from './agency.js'
import type { Locale } from './i18n.js'

/** Saisie du formulaire d'inscription agence (étape 1 du classeur de collecte). */
export interface AgencySignupData {
  civility: Civility | null
  firstName: string
  lastName: string
  email: string
  password: string
  companyName: string
  country: string
  /** Numéro de TVA intracommunautaire ou SIRET, tel que saisi. */
  taxId: string
  website: string | null
  phone: string | null
  /**
   * Email de contact de l'agence (`organizations.email`), transmis aux
   * fournisseurs abonnés (#221). `null` : ils reçoivent celui de l'auteur.
   */
  contactEmail: string | null
  activity: AgencyActivity
  activityOther: string | null
  locale: Locale
  /** Cases à cocher : les deux premières sont obligatoires, la dernière facultative. */
  certifiesProfessional: boolean
  acceptsTerms: boolean
  acceptsPartnerCommunications: boolean
}

/** Contexte de la requête, conservé comme preuve des consentements. */
export interface AgencySignupContext {
  ipAddress: string | null
  /** Langue de la page d'inscription, utilisée pour le mail de vérification. */
  pageLocale: string
}

/**
 * Pourquoi un compte n'est pas activé automatiquement. Une inscription sans
 * motif est active immédiatement ; sinon l'équipe la valide (sous 24 h).
 */
export const AGENCY_REVIEW_REASONS = [
  'vat_unverified',
  'free_email_domain',
  'domain_mismatch',
  'no_website',
  'other_activity',
] as const

export type AgencyReviewReason = (typeof AGENCY_REVIEW_REASONS)[number]

/** Résultat d'un contrôle VIES. `unavailable` : service ou pays non interrogeable. */
export type VatCheckStatus = 'valid' | 'invalid' | 'unavailable'
