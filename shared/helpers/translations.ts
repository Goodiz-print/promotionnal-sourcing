import { DEFAULT_LOCALE, type Locale } from '../types/i18n.js'

/**
 * Une ligne de traduction porte au minimum une `locale`.
 */
export interface LocalizedRow {
  locale: string
}

/**
 * Sélectionne, dans une collection de traductions préchargée, la ligne
 * correspondant à la locale demandée. Repli sur la locale par défaut, puis
 * sur la première ligne disponible. Renvoie `undefined` si la collection est
 * vide/absente.
 */
export function resolveTranslation<T extends LocalizedRow>(
  translations: readonly T[] | undefined,
  locale: Locale,
  fallback: Locale = DEFAULT_LOCALE
): T | undefined {
  if (!translations || translations.length === 0) {
    return undefined
  }

  return (
    translations.find((t) => t.locale === locale) ??
    translations.find((t) => t.locale === fallback) ??
    translations[0]
  )
}
