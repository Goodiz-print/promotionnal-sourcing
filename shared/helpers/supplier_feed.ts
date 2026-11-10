/**
 * Utilitaires purs des connecteurs fournisseurs (parsing de valeurs hétérogènes).
 */

/**
 * Nombre depuis une valeur de flux : `17,5`, `"0.62"`, `150`, `""`, `null`.
 * Renvoie `null` pour une valeur vide ou non numérique.
 */
export function parseDecimal(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const cleaned = value.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '') return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

/** Entier strictement positif, sinon `null`. */
export function parsePositiveInt(value: unknown): number | null {
  const parsed = parseDecimal(value)
  if (parsed === null || parsed <= 0) return null
  return Math.round(parsed)
}

/** Chaîne nettoyée, `null` si vide. */
export function cleanString(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}

/** Centimètres → millimètres arrondis. */
export function cmToMm(value: unknown): number | null {
  const cm = parseDecimal(value)
  return cm === null || cm <= 0 ? null : Math.round(cm * 10)
}

/** Kilogrammes → grammes arrondis. */
export function kgToG(value: unknown): number | null {
  const kg = parseDecimal(value)
  return kg === null || kg <= 0 ? null : Math.round(kg * 1000)
}

/** Garantit un tableau (les flux renvoient parfois un objet seul au lieu d'une liste). */
export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * Masque les parties secrètes d'une URL avant de la journaliser : le code de
 * flux PF Concept (segment `_<uuid>_v3`) et toute query string.
 */
export function redactUrl(url: string): string {
  return url.replace(/(feed_)[0-9a-f_]{20,}(_v3)/gi, '$1***$2').replace(/\?.*$/, '?***')
}

/**
 * Libellé normalisé pour le rapprochement de référentiels : minuscules, sans
 * accents, ponctuation remplacée par des espaces, espaces compactés.
 */
export function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Codes pays des flux (ISO-2, ISO-3 ou libellés courants) → ISO-2, `null` si
 * inconnu. PF Concept utilise par exemple `PRC` pour la Chine.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  PRC: 'CN',
  CHN: 'CN',
  CHINA: 'CN',
  CHINE: 'CN',
  FRA: 'FR',
  FRANCE: 'FR',
  DEU: 'DE',
  GER: 'DE',
  ALLEMAGNE: 'DE',
  GERMANY: 'DE',
  ITA: 'IT',
  ITALIE: 'IT',
  ITALY: 'IT',
  ESP: 'ES',
  ESPAGNE: 'ES',
  SPAIN: 'ES',
  POL: 'PL',
  POLOGNE: 'PL',
  POLAND: 'PL',
  NLD: 'NL',
  GBR: 'GB',
  UK: 'GB',
  PRT: 'PT',
  PORTUGAL: 'PT',
  IND: 'IN',
  INDE: 'IN',
  INDIA: 'IN',
  VNM: 'VN',
  TUR: 'TR',
  TURQUIE: 'TR',
  BGD: 'BD',
  PAK: 'PK',
  TWN: 'TW',
  HKG: 'HK',
  USA: 'US',
}

export function normalizeCountry(value: unknown): string | null {
  const raw = cleanString(value)
  if (!raw) return null
  const upper = normalizeLabel(raw).toUpperCase().replace(/\s/g, '')
  if (COUNTRY_ALIASES[upper]) return COUNTRY_ALIASES[upper]
  return /^[A-Z]{2}$/.test(upper) ? upper : null
}
