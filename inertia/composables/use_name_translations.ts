import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'

/** Traductions d'un référentiel à nom seul : une entrée par langue de contenu. */
export type NameTranslations = Record<ContentLocale, { name: string }>

/** État initial : le nom existant de chaque langue, chaîne vide sinon. */
export function initialNameTranslations(
  source?: Record<ContentLocale, { name: string }>
): NameTranslations {
  const translations = {} as NameTranslations
  for (const locale of CONTENT_LOCALES) {
    translations[locale] = { name: source?.[locale]?.name ?? '' }
  }
  return translations
}

/**
 * Charge utile des traductions : la langue source est toujours envoyée, les
 * autres seulement si renseignées (sinon générées automatiquement par le serveur).
 */
export function buildNameTranslations(
  translations: NameTranslations,
  sourceLocale: ContentLocale
): Partial<NameTranslations> {
  const payload: Partial<NameTranslations> = {}
  for (const locale of CONTENT_LOCALES) {
    if (locale === sourceLocale || translations[locale].name) {
      payload[locale] = { name: translations[locale].name }
    }
  }
  return payload
}

/** Synonymes saisis en une ligne séparée par des virgules -> tableau nettoyé. */
export function parseSynonyms(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}
