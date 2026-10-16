/**
 * Langues de l'interface (préfixe d'URL, sélecteur, fichiers `resources/lang`).
 * Le premier élément est la locale par défaut (source).
 */
export const SUPPORTED_LOCALES = ['fr', 'en', 'de', 'es', 'it', 'nl', 'pt', 'pl', 'sv'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'fr'

/**
 * Langues dans lesquelles le **contenu du catalogue** (produits, catégories,
 * fournisseurs) est saisi. Plus restreint que `SUPPORTED_LOCALES` : l'interface
 * est traduite en 9 langues, mais les fournisseurs ne renseignent leurs fiches
 * qu'en français et en anglais ; les autres langues retombent sur l'anglais.
 * Ajouter une langue de contenu = l'ajouter ici et dans `LOCALE_TSCONFIG`, puis
 * migration `CREATE INDEX … WHERE locale = '<xx>'` + backfill de ses lignes.
 */
export const CONTENT_LOCALES = ['fr', 'en'] as const

export type ContentLocale = (typeof CONTENT_LOCALES)[number]

/** Langue de contenu obligatoire à la saisie (sert notamment à dériver le slug). */
export const DEFAULT_CONTENT_LOCALE: ContentLocale = 'fr'

/**
 * Langue de contenu à servir pour une langue d'interface : la langue elle-même
 * si le catalogue y est traduit, sinon l'anglais (lingua franca du sourcing).
 */
export function contentLocaleFor(locale: Locale): ContentLocale {
  return (CONTENT_LOCALES as readonly string[]).includes(locale) ? (locale as ContentLocale) : 'en'
}

/**
 * Nom du cookie utilisé pour persister la préférence de langue
 * côté client (visiteurs non authentifiés).
 */
export const LOCALE_COOKIE = 'locale'

/**
 * Libellés des langues, affichés dans le sélecteur de langue.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  nl: 'Nederlands',
  pt: 'Português',
  pl: 'Polski',
  sv: 'Svenska',
}

const LOCALE_ALTERNATION = SUPPORTED_LOCALES.join('|')

/** Contrainte de la route `/:locale` : n'accepte que les langues supportées. */
export const LOCALE_ROUTE_PATTERN = new RegExp(`^(${LOCALE_ALTERNATION})$`)

/** Préfixe de locale en tête d'un chemin (`/fr/contact` → `/fr`), sans consommer la suite. */
export const LOCALE_PREFIX_PATTERN = new RegExp(`^/(${LOCALE_ALTERNATION})(?=/|$|\\?|#)`)

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Configuration de recherche plein-texte PostgreSQL par locale (stemming).
 * Source unique : `ProductTranslationSearchService` calcule
 * `product_translations.search_vector` à l'écriture avec cette config. Toute
 * locale absente retombe sur `'simple'` (pas de stemming).
 */
export const LOCALE_TSCONFIG: Record<ContentLocale, string> = {
  fr: 'french',
  en: 'english',
}

export const DEFAULT_TSCONFIG = 'simple'

/**
 * Domaines de traduction qui ne sont pas traduits dans chaque langue d'interface
 * (textes juridiques, à faire valider par un humain avant publication) : une
 * langue qui n'a pas le fichier retombe sur l'anglais.
 */
export const ENGLISH_FALLBACK_NAMESPACES = ['legal', 'privacy'] as const

/**
 * Dictionnaire plat de messages ICU pour une locale donnée
 * (clés au format "domaine.chemin.cle"), tel qu'exposé au frontend.
 */
export type Translations = Record<string, string>
