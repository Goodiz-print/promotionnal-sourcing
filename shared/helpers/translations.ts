import { DEFAULT_LOCALE } from '../types/i18n.js'

/**
 * Une ligne de traduction porte au minimum une `locale`.
 */
export interface LocalizedRow {
  locale: string
}

/**
 * Sélectionne, dans une collection de traductions préchargée, la ligne
 * correspondant à la locale demandée. Repli, dans l'ordre : la langue source de
 * l'entité (`sourceLocale`, toujours renseignée par le fournisseur), l'anglais,
 * la locale par défaut, puis la première ligne par ordre alphabétique de locale
 * (déterministe, indépendant de l'ordre de chargement). Renvoie `undefined` si
 * la collection est vide/absente.
 */
export function resolveTranslation<T extends LocalizedRow>(
  translations: readonly T[] | undefined,
  locale: string,
  sourceLocale?: string | null,
  fallback: string = DEFAULT_LOCALE
): T | undefined {
  if (!translations || translations.length === 0) {
    return undefined
  }

  return (
    translations.find((t) => t.locale === locale) ??
    (sourceLocale ? translations.find((t) => t.locale === sourceLocale) : undefined) ??
    translations.find((t) => t.locale === 'en') ??
    translations.find((t) => t.locale === fallback) ??
    [...translations].sort((a, b) => a.locale.localeCompare(b.locale))[0]
  )
}
