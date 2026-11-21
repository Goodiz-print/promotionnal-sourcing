import type { BuyerContactSource, BuyerContactType } from '../types/rfq.js'

/**
 * Bloc de coordonnées de l'agence (#221), tel que le lit un fournisseur abonné.
 * Calcul pur, partagé par l'écran et les mails : l'email de contact de l'agence
 * prime, et se rabat sur celui de l'auteur de la demande.
 */
export function buyerContactOf(source: BuyerContactSource, locale: string): BuyerContactType {
  const { organization, requester } = source
  return {
    agencyName: organization.name,
    requesterName: requester?.fullName ?? null,
    email: organization.email || requester?.email || null,
    phone: organization.phone || null,
    addressLines: addressLinesOf(organization, locale),
  }
}

/** Lignes de l'adresse postale, sans ligne vide ; le pays est nommé dans `locale`. */
function addressLinesOf(organization: BuyerContactSource['organization'], locale: string) {
  const cityLine = [organization.postalCode, organization.city].filter(Boolean).join(' ')
  const hasStreet = Boolean(organization.addressLine1 || organization.addressLine2 || cityLine)
  const country = hasStreet ? countryName(organization.country, locale) : null
  return [organization.addressLine1, organization.addressLine2, cityLine, country].filter(
    (line): line is string => Boolean(line?.trim())
  )
}

/**
 * Le pays seul ne fait pas une adresse : il n'est cité que sous une rue ou une
 * ville. Code inconnu de `Intl` : le code tel quel.
 */
function countryName(code: string | null, locale: string): string | null {
  if (!code) return null
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
