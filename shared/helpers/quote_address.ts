import { DEFAULT_LOCALE } from '../types/i18n.js'
import type { QuoteAddressCandidates, QuoteAddressSource, RfqMailAddress } from '../types/rfq.js'

type ExplicitCandidates = Pick<
  QuoteAddressCandidates,
  'quoteEmail' | 'quoteEmailVerified' | 'organizationEmail'
>

/** Adresse explicite retenue et le niveau d'où elle vient. */
interface ExplicitAddress {
  source: Exclude<QuoteAddressSource, 'members'>
  email: string
}

/**
 * Adresse explicite qui reçoit les demandes de devis (#217), ou `null` s'il n'y
 * en a pas : l'adresse de réception du profil **confirmée**, puis l'adresse de
 * contact de l'organisation. Une adresse vide ou faite d'espaces compte comme
 * absente.
 *
 * Même règle que le filtre SQL `withoutQuoteAddress`
 * (`AdminOrganizationService`) : modifier l'une impose de modifier l'autre.
 */
function explicitAddress(candidates: ExplicitCandidates): ExplicitAddress | null {
  const quoteEmail = candidates.quoteEmail?.trim()
  if (quoteEmail && candidates.quoteEmailVerified) {
    return { source: 'quote_email', email: quoteEmail }
  }
  const organizationEmail = candidates.organizationEmail?.trim()
  if (organizationEmail) return { source: 'organization_email', email: organizationEmail }
  return null
}

/**
 * Niveau de repli utilisé pour joindre un fournisseur : `quote_email`,
 * `organization_email`, sinon `members`.
 */
export function quoteAddressSource(candidates: ExplicitCandidates): QuoteAddressSource {
  return explicitAddress(candidates)?.source ?? 'members'
}

/**
 * Adresses à prévenir pour un fournisseur, chacune avec sa langue.
 *
 * Une adresse explicite n'appartient à aucun compte : elle prend la langue du
 * membre responsable le plus ancien, à défaut la langue par défaut. Sinon,
 * chaque membre responsable est prévenu dans sa langue, une seule fois par
 * adresse.
 */
export function resolveQuoteAddresses(candidates: QuoteAddressCandidates): RfqMailAddress[] {
  const explicit = explicitAddress(candidates)
  if (!explicit) return uniqueByEmail(candidates.members)

  const locale = candidates.members[0]?.locale ?? DEFAULT_LOCALE
  return [{ email: explicit.email, locale }]
}

/**
 * La saisie change-t-elle l'adresse de réception ? Une valeur absente de la
 * saisie (`undefined`) ne change rien ; la casse et les espaces sont ignorés.
 * Un changement remet la confirmation à zéro et renvoie un lien.
 */
export function hasQuoteEmailChanged(
  previous: string | null,
  next: string | null | undefined
): boolean {
  if (next === undefined) return false
  const normalize = (value: string | null) => value?.trim().toLowerCase() || null
  return normalize(previous) !== normalize(next)
}

function uniqueByEmail(addresses: RfqMailAddress[]): RfqMailAddress[] {
  return [...new Map(addresses.map((address) => [address.email, address])).values()]
}
