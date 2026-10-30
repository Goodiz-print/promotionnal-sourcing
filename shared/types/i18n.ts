/**
 * Langues de l'interface (préfixe d'URL, sélecteur, fichiers `resources/lang`).
 * Le premier élément est la locale par défaut (source).
 */
export const SUPPORTED_LOCALES = ['fr', 'en', 'de', 'es', 'it', 'nl', 'pt', 'pl', 'sv'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'fr'

/**
 * Langues cibles de la traduction automatique du contenu (#75, liste figée) :
 * 24 de l'UE et 8 hors UE. Ru et be sont exclues (décision du 15 octobre 2026).
 * Une traduction est générée par produit, catégorie, attribut et valeur, pour
 * chaque langue de cette liste sauf la langue source. `fr` et `en` viennent en
 * tête : ce sont les langues de saisie les plus courantes dans les sélecteurs.
 */
export const TRANSLATION_LOCALES = [
  'fr',
  'en',
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'es',
  'et',
  'fi',
  'ga',
  'hr',
  'hu',
  'it',
  'lt',
  'lv',
  'mt',
  'nl',
  'pl',
  'pt',
  'ro',
  'sk',
  'sl',
  'sv',
  'no',
  'is',
  'uk',
  'sr',
  'bs',
  'mk',
  'sq',
  'tr',
] as const

export type TranslationLocale = (typeof TRANSLATION_LOCALES)[number]

/**
 * Langues dans lesquelles le **contenu du catalogue** (produits, catégories,
 * fournisseurs) est saisi ou traduit : les 32 langues de la traduction
 * automatique (#97). Ajouter une langue de contenu = l'ajouter à
 * `TRANSLATION_LOCALES` : Meilisearch indexe les noms et descriptions de toutes
 * les langues sous des sous-clés (ADR 0002), sans index ni migration par langue.
 */
export const CONTENT_LOCALES = TRANSLATION_LOCALES

export type ContentLocale = TranslationLocale

/**
 * Langues dont une ligne est toujours écrite pour les contenus qui n'ont pas de
 * traduction automatique (nom d'un fournisseur, certifications, techniques de
 * marquage) : toute autre langue retombe sur l'anglais (`resolveTranslation`).
 */
export const BASELINE_CONTENT_LOCALES = ['fr', 'en'] as const satisfies readonly ContentLocale[]

/** Langue de contenu obligatoire à la saisie (sert notamment à dériver le slug). */
export const DEFAULT_CONTENT_LOCALE: ContentLocale = 'fr'

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

/**
 * Libellés (endonymes) des langues de contenu, affichés dans les sélecteurs de
 * langue de saisie. Superset de `LOCALE_LABELS`.
 */
export const CONTENT_LOCALE_LABELS: Record<ContentLocale, string> = {
  fr: 'Français',
  en: 'English',
  bg: 'Български',
  cs: 'Čeština',
  da: 'Dansk',
  de: 'Deutsch',
  el: 'Ελληνικά',
  es: 'Español',
  et: 'Eesti',
  fi: 'Suomi',
  ga: 'Gaeilge',
  hr: 'Hrvatski',
  hu: 'Magyar',
  it: 'Italiano',
  lt: 'Lietuvių',
  lv: 'Latviešu',
  mt: 'Malti',
  nl: 'Nederlands',
  pl: 'Polski',
  pt: 'Português',
  ro: 'Română',
  sk: 'Slovenčina',
  sl: 'Slovenščina',
  sv: 'Svenska',
  no: 'Norsk',
  is: 'Íslenska',
  uk: 'Українська',
  sr: 'Српски',
  bs: 'Bosanski',
  mk: 'Македонски',
  sq: 'Shqip',
  tr: 'Türkçe',
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
 * Domaines de traduction qui ne sont pas traduits dans chaque langue d'interface
 * (textes juridiques, à faire valider par un humain avant publication) : une
 * langue qui n'a pas le fichier retombe sur l'anglais.
 */
export const ENGLISH_FALLBACK_NAMESPACES = [
  'legal',
  'privacy',
  'admin',
  'notifications',
  'order',
] as const

/**
 * Dictionnaire plat de messages ICU pour une locale donnée
 * (clés au format "domaine.chemin.cle"), tel qu'exposé au frontend.
 */
export type Translations = Record<string, string>
