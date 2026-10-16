import type { Locale } from '#shared/types/i18n'

/**
 * Pages publiques de la landing, hors accueil. Le slug est identique dans
 * toutes les langues (`/fr/legal`, `/en/legal`) ; seul le préfixe de locale change.
 */
export const MARKETING_PAGES = ['contact', 'legal', 'privacy', 'thanks'] as const

export type MarketingPage = (typeof MARKETING_PAGES)[number]

/**
 * Pages à référencer dans le sitemap : la page de remerciement est en noindex
 * et n'a donc rien à faire dans ce que l'on soumet aux moteurs.
 */
export const SITEMAP_PAGES: readonly ('' | MarketingPage)[] = ['', 'contact', 'legal', 'privacy']

/** Adresse de contact affichée sur la landing et utilisée par les `mailto:`. */
export const CONTACT_EMAIL = 'contact@promotional-sourcing.eu'

/** Valeur `og:locale` (langue_PAYS) de chaque langue de l'interface. */
export const OG_LOCALES: Record<Locale, string> = {
  fr: 'fr_FR',
  en: 'en_US',
  de: 'de_DE',
  es: 'es_ES',
  it: 'it_IT',
  nl: 'nl_NL',
  pt: 'pt_PT',
  pl: 'pl_PL',
  sv: 'sv_SE',
}

/**
 * Visuel de partage (`public/og-<code>.png`) par langue : seuls le français et
 * l'anglais existent, les autres langues reprennent la version anglaise.
 */
export const OG_IMAGE_LOCALES: Record<Locale, 'fr' | 'en'> = {
  fr: 'fr',
  en: 'en',
  de: 'en',
  es: 'en',
  it: 'en',
  nl: 'en',
  pt: 'en',
  pl: 'en',
  sv: 'en',
}
