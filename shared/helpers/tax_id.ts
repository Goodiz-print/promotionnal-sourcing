import { VIES_COUNTRY_CODES } from '../types/country.js'

/**
 * Identifiant fiscal saisi par une entreprise : numéro de TVA intracommunautaire
 * ou, pour la France, SIRET (14 chiffres). Un SIRET est converti en numéro de TVA
 * français (clé calculée depuis le SIREN) pour passer par le même contrôle VIES.
 */
export interface ResolvedTaxId {
  kind: 'vat' | 'siret'
  /** Code pays tel que VIES l'attend (`EL` pour la Grèce). */
  countryCode: string
  /** Numéro sans le préfixe pays. */
  vatNumber: string
  /** Renseigné quand la saisie était un SIRET. */
  siret: string | null
}

/** Majuscules, sans espace, point, tiret ni barre oblique. */
export function normalizeTaxId(raw: string): string {
  return raw.toUpperCase().replace(/[\s.\-/]/g, '')
}

/** Contrôle de Luhn, appliqué au SIRET (14 chiffres). */
export function isValidSiret(value: string): boolean {
  if (!/^\d{14}$/.test(value)) return false
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let digit = Number(value[13 - i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

/** Numéro de TVA français : clé = (12 + 3 × (SIREN mod 97)) mod 97, sur 2 chiffres. */
export function frenchVatFromSiren(siren: string): string {
  const key = (12 + 3 * (Number(siren) % 97)) % 97
  return `${String(key).padStart(2, '0')}${siren}`
}

/**
 * Interprète la saisie, ou `null` si elle n'a la forme ni d'un SIRET valide ni
 * d'un numéro de TVA (2 lettres de pays puis 2 à 12 caractères).
 */
export function resolveTaxId(raw: string): ResolvedTaxId | null {
  const value = normalizeTaxId(raw)

  if (/^\d{14}$/.test(value)) {
    if (!isValidSiret(value)) return null
    return {
      kind: 'siret',
      countryCode: 'FR',
      vatNumber: frenchVatFromSiren(value.slice(0, 9)),
      siret: value,
    }
  }

  const match = /^([A-Z]{2})([0-9A-Z+*]{2,12})$/.exec(value)
  if (!match) return null
  return { kind: 'vat', countryCode: match[1], vatNumber: match[2], siret: null }
}

/** `true` si le pays est interrogeable dans VIES. */
export function isViesCountry(countryCode: string): boolean {
  return (VIES_COUNTRY_CODES as readonly string[]).includes(countryCode)
}
