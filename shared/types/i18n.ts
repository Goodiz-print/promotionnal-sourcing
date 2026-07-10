/**
 * Locales supportées par l'application.
 * Le premier élément est la locale par défaut (source).
 */
export const SUPPORTED_LOCALES = ['fr', 'en'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'fr'

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
}

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Configuration de recherche plein-texte PostgreSQL par locale (stemming).
 * Doit rester synchronisé avec le `CASE` de la colonne générée
 * `product_translations.search_vector`. Toute locale absente retombe sur
 * `'simple'` (pas de stemming). Ajouter une langue = ajouter une entrée ici
 * ET une branche `WHEN` dans la migration.
 */
export const LOCALE_TSCONFIG: Record<Locale, string> = {
  fr: 'french',
  en: 'english',
}

export const DEFAULT_TSCONFIG = 'simple'

/**
 * Dictionnaire plat de messages ICU pour une locale donnée
 * (clés au format "domaine.chemin.cle"), tel qu'exposé au frontend.
 */
export type Translations = Record<string, string>
