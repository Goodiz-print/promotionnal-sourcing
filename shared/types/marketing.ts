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
