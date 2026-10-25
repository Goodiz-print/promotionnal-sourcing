/**
 * Nature d'un consentement ou d'une signature électronique tracé dans le
 * journal `legal_consents` :
 * - `terms` : CGU (agence ou fournisseur selon le type de l'organisation) ;
 * - `data_license` : contrat de licence de données (fournisseur, il reste propriétaire) ;
 * - `supplier_marketing` : autorisation d'actions marketing (fournisseur) ;
 * - `professional_certification` : « je certifie être un professionnel de l'objet… » (agence) ;
 * - `partner_communications` : newsletter / emails régie (agence, jamais pré-coché).
 */
export const LEGAL_CONSENT_KINDS = [
  'terms',
  'data_license',
  'supplier_marketing',
  'professional_certification',
  'partner_communications',
] as const

export type LegalConsentKind = (typeof LEGAL_CONSENT_KINDS)[number]

/** Données de preuve d'un consentement (version du texte, date, IP conservées). */
export interface RecordConsentData {
  organizationId: number
  userId: number | null
  kind: LegalConsentKind
  version: string
  ipAddress: string | null
}

/**
 * Version des textes juridiques acceptés à l'inscription (date de publication).
 * À incrémenter quand le texte change : le journal garde la version signée.
 */
export const CURRENT_LEGAL_VERSION = '2026-10-19'
