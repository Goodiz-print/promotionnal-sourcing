import type { LegalConsentKind } from '#shared/types/legal'

/** Filtres de la liste des consentements (query string). */
export interface AdminConsentFilters {
  /** Nom d'organisation, recherche partielle. */
  organization: string | null
  /** Email de l'utilisateur signataire, recherche partielle. */
  user: string | null
  kind: LegalConsentKind | null
  version: string | null
  /** Seulement les consentements actifs signés sur une version autre que la version courante. */
  outdated: boolean
}

/** Ligne du journal des consentements (preuve : version, date, IP). */
export interface AdminConsentRow {
  id: number
  kind: LegalConsentKind
  version: string
  acceptedAt: string
  revokedAt: string | null
  ipAddress: string | null
  organization: { id: number; name: string }
  user: { id: number; email: string } | null
  /** Consentement actif dont la version n'est plus la version courante. */
  outdated: boolean
}

/** Pied de page de l'écran : version courante des textes et consentements à re-signer. */
export interface AdminConsentOverview {
  currentVersion: string
  outdatedCount: number
}
