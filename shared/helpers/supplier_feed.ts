/**
 * Utilitaires purs des connecteurs fournisseurs (parsing de valeurs hétérogènes).
 */
import type { NormalizedPriceTier } from '#shared/types/supplier_feed'

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

/**
 * Entier écrit avec des points de milliers (`"24.000"` = 24 000, format
 * espagnol des stocks Makito). Seuls les groupes de trois chiffres sont des
 * milliers : `"24.0"` ou `"0.5"` (décimaux) sont refusés plutôt que lus 240 ou
 * 5. `null` si vide, décimal ou non numérique.
 */
export function parseGroupedInt(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null
  if (typeof value !== 'string') return null
  const cleaned = value.trim().replace(/\s/g, '')
  if (/^\d+$/.test(cleaned)) return Number(cleaned)
  return /^\d{1,3}(\.\d{3})+$/.test(cleaned) ? Number(cleaned.replaceAll('.', '')) : null
}

/**
 * Paliers depuis des colonnes numérotées `section_n` / `price_n` (Makito). Le
 * premier palier part toujours de 1 pièce ; les colonnes à prix nul sont vides.
 * - `from` (prix produit) : `section_n` est le **seuil bas** du palier n
 *   (`-500, 500, 2000` = moins de 500, dès 500, dès 2000) ;
 * - `upTo` (prix de marquage) : `section_n` est la **borne haute** du palier n
 *   (`250, 500, 2000` = jusqu'à 250, 251-500, 501-2000).
 */
export function sectionPriceTiers(
  row: Record<string, unknown>,
  mode: 'from' | 'upTo',
  sections = 10
): NormalizedPriceTier[] {
  const tiers: NormalizedPriceTier[] = []
  let previousBound = 0
  for (let index = 1; index <= sections; index++) {
    const section = parseDecimal(row[`section_${index}`])
    const unitPrice = parseDecimal(row[`price_${index}`])
    if (section === null || unitPrice === null || unitPrice <= 0) continue
    const bound = Math.round(Math.abs(section))
    // Borne haute répétée (`500, 500`) : tranche vide, colonne ignorée.
    if (mode === 'upTo' && tiers.length > 0 && bound <= previousBound) continue
    const minQuantity = tiers.length === 0 ? 1 : mode === 'from' ? bound : previousBound + 1
    previousBound = bound
    if (tiers.some((tier) => tier.minQuantity >= minQuantity)) continue
    tiers.push({ minQuantity, unitPrice })
  }
  return tiers
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

/** Texte sans balise HTML (`cm<sup>2</sup>` → `cm2`), `null` si vide. */
export function stripHtml(value: unknown): string | null {
  return cleanString(cleanString(value)?.replace(/<[^>]+>/g, '') ?? null)
}

/** Longueur → millimètres arrondis selon l'unité annoncée (`mm`, sinon centimètres). */
export function lengthToMm(value: unknown, unit: unknown): number | null {
  const length = parseDecimal(value)
  if (length === null || length <= 0) return null
  return Math.round(cleanString(unit)?.toLowerCase() === 'mm' ? length : length * 10)
}

/** Poids → grammes arrondis selon l'unité annoncée (`kg`, sinon grammes). */
export function weightToGrams(value: unknown, unit: unknown): number | null {
  const weight = parseDecimal(value)
  if (weight === null || weight <= 0) return null
  return Math.round(cleanString(unit)?.toLowerCase() === 'kg' ? weight * 1000 : weight)
}

/** Filtre de valeurs renseignées (`.filter(isPresent)` affine le type). */
export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Paliers triés par quantité de départ, dédoublonnés : pour une même quantité,
 * le dernier prix l'emporte.
 */
export function sortedPriceTiers(tiers: NormalizedPriceTier[]): NormalizedPriceTier[] {
  return [...new Map(tiers.map((tier) => [tier.minQuantity, tier.unitPrice]))]
    .sort(([a], [b]) => a - b)
    .map(([minQuantity, unitPrice]) => ({ minQuantity, unitPrice }))
}

/**
 * Index `clé → valeur` d'une liste. Les éléments sans clé ou sans valeur
 * (`null`) sont écartés ; pour une même clé, le dernier élément l'emporte.
 */
export function indexBy<T, V>(
  items: T[],
  keyOf: (item: T) => string | null,
  valueOf: (item: T) => V | null
): Map<string, V> {
  return new Map(
    items.flatMap((item): Array<[string, V]> => {
      const key = keyOf(item)
      const value = key === null ? null : valueOf(item)
      return key === null || value === null ? [] : [[key, value]]
    })
  )
}

/**
 * Regroupe les valeurs d'une liste par clé, dans l'ordre de la liste. Les
 * éléments sans clé ou sans valeur (`null`) sont écartés.
 */
export function groupBy<T, V>(
  items: T[],
  keyOf: (item: T) => string | null,
  valueOf: (item: T) => V | null
): Map<string, V[]> {
  return items.reduce((groups, item) => {
    const key = keyOf(item)
    const value = key === null ? null : valueOf(item)
    if (key === null || value === null) return groups
    const group = groups.get(key)
    if (group) group.push(value)
    else groups.set(key, [value])
    return groups
  }, new Map<string, V[]>())
}

/** Plus petite valeur par clé (`[clé, valeur]`). */
export function lowestByKey(entries: Array<readonly [string, number]>): Map<string, number> {
  return entries.reduce(
    (lowest, [key, value]) => lowest.set(key, Math.min(value, lowest.get(key) ?? value)),
    new Map<string, number>()
  )
}

/** Somme des valeurs par clé (`[clé, valeur]`). */
export function sumByKey(entries: Array<readonly [string, number]>): Map<string, number> {
  return entries.reduce(
    (sums, [key, value]) => sums.set(key, (sums.get(key) ?? 0) + value),
    new Map<string, number>()
  )
}

/** Garantit un tableau (les flux renvoient parfois un objet seul au lieu d'une liste). */
export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * Masque les parties secrètes d'une URL avant de la journaliser :
 * - tout segment `feed_<…>_v3` qui n'est pas un code langue (`productfeed_fr_v3`
 *   reste lisible, `pricefeed_<code distributeur>_v3` est masqué quel que soit
 *   le format du code : UUID, tirets, longueur…) ;
 * - toute occurrence littérale des `secrets` fournis (valeurs de `.env`) ;
 * - toute query string.
 */
export function redactUrl(url: string, secrets: Array<string | null | undefined> = []): string {
  let redacted = url
  for (const secret of secrets) {
    if (secret && secret.length >= 4) redacted = redacted.split(secret).join('***')
  }
  return redacted
    .replace(/(feed_)(?![a-z]{2}_v3)[^/?#]+?(_v3)/gi, '$1***$2')
    .replace(/\?.*$/, '?***')
}

/**
 * Grille de prix d'une fiche à partir des grilles de ses déclinaisons : la
 * grille **complète** de la déclinaison la moins chère (prix d'appel le plus
 * bas, puis prix au plus grand palier le plus bas). On ne mélange jamais les
 * paliers de grilles différentes : un minimum palier par palier sur des
 * grilles aux seuils différents donnerait une grille incohérente (prix qui
 * remonte avec la quantité). Les déclinaisons dont la grille diffère gardent
 * leurs propres paliers (`SupplierCatalogueImporter`).
 */
export function cheapestPriceGrid(grids: NormalizedPriceTier[][]): NormalizedPriceTier[] {
  let best: NormalizedPriceTier[] = []
  for (const grid of grids) {
    if (grid.length === 0) continue
    const sorted = [...grid].sort((a, b) => a.minQuantity - b.minQuantity)
    if (best.length === 0) {
      best = sorted
      continue
    }
    const entry = sorted[0].unitPrice - best[0].unitPrice
    const volume = sorted[sorted.length - 1].unitPrice - best[best.length - 1].unitPrice
    if (entry < 0 || (entry === 0 && volume < 0)) best = sorted
  }
  return best.map((tier) => ({ ...tier }))
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
  ESPANA: 'ES',
  ITALIA: 'IT',
  ALEMANIA: 'DE',
  FRANCIA: 'FR',
  POLONIA: 'PL',
  TURQUIA: 'TR',
  TURKEY: 'TR',
  BANGLADESH: 'BD',
  PAKISTAN: 'PK',
  VIETNAM: 'VN',
  INDONESIA: 'ID',
  MONGOLIA: 'MN',
  TAIWAN: 'TW',
  THAILAND: 'TH',
  TAILANDIA: 'TH',
  CAMBODIA: 'KH',
  CAMBOYA: 'KH',
  MALAYSIA: 'MY',
  MALASIA: 'MY',
  NETHERLANDS: 'NL',
  BELGIUM: 'BE',
  AUSTRIA: 'AT',
  CZECHREPUBLIC: 'CZ',
}

export function normalizeCountry(value: unknown): string | null {
  const raw = cleanString(value)
  if (!raw) return null
  const upper = normalizeLabel(raw).toUpperCase().replace(/\s/g, '')
  if (COUNTRY_ALIASES[upper]) return COUNTRY_ALIASES[upper]
  return /^[A-Z]{2}$/.test(upper) ? upper : null
}
