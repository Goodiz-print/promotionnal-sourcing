/**
 * Date courte dans la langue donnée (`toLocaleDateString`, format court par
 * défaut de la locale) : `formatShortDate('2026-11-24T10:00:00Z', 'fr')` →
 * `24/11/2026`. `value` est une date ISO telle que l'envoient les transformers.
 */
export function formatShortDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale)
}
