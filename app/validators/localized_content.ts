import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'

/**
 * Construit un nœud VineJS optionnel par langue de contenu (`CONTENT_LOCALES`) à
 * partir d'une fabrique de nœud. Le cast restitue les clés littérales, que
 * `Object.fromEntries` élargirait à `string` (le payload validé reste typé par
 * langue).
 */
export function perContentLocale<T extends { optional(): unknown }>(
  content: () => T
): Record<ContentLocale, ReturnType<T['optional']>> {
  return Object.fromEntries(
    CONTENT_LOCALES.map((locale) => [locale, content().optional()])
  ) as Record<ContentLocale, ReturnType<T['optional']>>
}
