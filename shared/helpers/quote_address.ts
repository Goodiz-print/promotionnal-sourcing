import { DEFAULT_LOCALE } from '../types/i18n.js'
import type { QuoteAddressCandidates, QuoteAddressSource, RfqMailAddress } from '../types/rfq.js'

/**
 * Niveau de repli utilisé pour joindre un fournisseur (#217) : l'adresse de
 * réception du profil prime, puis l'adresse de contact de l'organisation, puis
 * les membres responsables. Une adresse vide ou faite d'espaces compte comme
 * absente.
 */
export function quoteAddressSource(
  candidates: Pick<QuoteAddressCandidates, 'quoteEmail' | 'organizationEmail'>
): QuoteAddressSource {
  if (candidates.quoteEmail?.trim()) return 'quote_email'
  if (candidates.organizationEmail?.trim()) return 'organization_email'
  return 'members'
}

/**
 * Adresses à prévenir pour un fournisseur, chacune avec sa langue.
 *
 * Une adresse explicite (réception ou contact) n'appartient à aucun compte :
 * elle prend la langue du membre responsable le plus ancien, à défaut la
 * langue par défaut. Sinon, chaque membre responsable est prévenu dans sa
 * langue, une seule fois par adresse.
 */
export function resolveQuoteAddresses(candidates: QuoteAddressCandidates): RfqMailAddress[] {
  const source = quoteAddressSource(candidates)
  if (source === 'members') return uniqueByEmail(candidates.members)

  const email = source === 'quote_email' ? candidates.quoteEmail! : candidates.organizationEmail!
  const locale = candidates.members[0]?.locale ?? DEFAULT_LOCALE
  return [{ email: email.trim(), locale }]
}

function uniqueByEmail(addresses: RfqMailAddress[]): RfqMailAddress[] {
  return [...new Map(addresses.map((address) => [address.email, address])).values()]
}
