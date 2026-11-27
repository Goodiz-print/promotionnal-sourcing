import type { StagingAgencyAccount, StagingSupplierAccount } from '#shared/types/seed'

/** Domaine des comptes fictifs (non routable : aucun mail ne part réellement). */
const FICTIONAL_DOMAIN = 'promotionnal-sourcing.test'

/** Nombre d'agences fictives créées sur le staging. */
export const STAGING_AGENCY_COUNT = 5

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Fiches importées par `supplier:import` (slug du connecteur), chacune portée
 * par un compte fournisseur fictif pour être publiée sur le staging.
 */
const IMPORTED_SUPPLIERS = [
  { supplierSlug: 'pf-concept', name: 'PF Concept' },
  { supplierSlug: 'passot-innovation', name: 'Passot Innovation' },
  { supplierSlug: 'inspirion', name: 'Inspirion' },
  { supplierSlug: 'makito', name: 'Makito' },
] as const

/**
 * E-mails des admins nominatifs (`SEED_ADMIN_EMAILS`, séparés par des virgules) :
 * normalisés, dédoublonnés, les valeurs qui ne sont pas des e-mails écartées.
 */
export function parseAdminEmails(raw: string | undefined): string[] {
  const emails = (raw ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => EMAIL_PATTERN.test(email))
  return [...new Set(emails)]
}

/** Prénom affiché d'un admin, déduit de la partie locale de son e-mail. */
export function firstNameFromEmail(email: string): string {
  const local = email.slice(0, email.indexOf('@')).split(/[._-]/)[0] ?? ''
  return local.charAt(0).toUpperCase() + local.slice(1)
}

/** Un compte fournisseur fictif par catalogue importé. */
export const STAGING_SUPPLIER_ACCOUNTS: StagingSupplierAccount[] = IMPORTED_SUPPLIERS.map(
  ({ supplierSlug, name }) => ({
    email: `fournisseur-${supplierSlug}@${FICTIONAL_DOMAIN}`,
    firstName: name,
    orgSlug: `${supplierSlug}-org`,
    orgName: name,
    supplierSlug,
  })
)

/** Agences fictives numérotées de 1 à `count`, chacune dans sa propre organisation. */
export function stagingAgencyAccounts(
  count: number = STAGING_AGENCY_COUNT
): StagingAgencyAccount[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1
    return {
      email: `agence-${n}@${FICTIONAL_DOMAIN}`,
      firstName: `Agence ${n}`,
      orgSlug: `agence-test-${n}`,
      orgName: `Agence test ${n}`,
    }
  })
}
