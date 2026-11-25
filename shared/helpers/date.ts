import { DISPLAY_TIMEZONE } from '../types/date.js'

/**
 * Date courte dans la langue donnée (`toLocaleDateString`, format court par
 * défaut de la locale) : `formatShortDate('2026-11-24T10:00:00Z', 'fr')` →
 * `24/11/2026`. `value` est une date ISO telle que l'envoient les transformers.
 * Le jour est celui de `DISPLAY_TIMEZONE`, quel que soit le fuseau d'exécution.
 */
export function formatShortDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, { timeZone: DISPLAY_TIMEZONE })
}

/**
 * Date et heure dans la langue donnée, à l'heure de `DISPLAY_TIMEZONE` :
 * `formatDateTime('2026-11-25T01:51:00Z', 'fr')` → `25 nov. 2026, 02:51`.
 * Le fuseau explicite rend le texte identique en SSR et dans le navigateur (#289).
 */
export function formatDateTime(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: DISPLAY_TIMEZONE,
  })
}
