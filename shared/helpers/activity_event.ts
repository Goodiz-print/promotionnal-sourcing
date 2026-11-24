import { DateTime } from 'luxon'
import { resolveTranslation } from './translations.js'
import {
  ACTIVITY_EVENT_PSEUDONYMIZE_AFTER_DAYS,
  type ActivityDateRange,
  type ActivityTargetCount,
  type ActivityTargetTranslation,
} from '../types/activity_event.js'

/**
 * Calculs purs des agrégations de consultations (#172), partagés par l'écran
 * admin « Ce que cherchent les clients » (#173) et l'espace fournisseur
 * « Consultations » (#239). Côté serveur uniquement (Luxon).
 */

/** Les `days` derniers jours, aujourd'hui compris. */
export function trailingDateRange(days: number, now: DateTime): ActivityDateRange {
  return {
    from: now.minus({ days: days - 1 }).toISODate()!,
    to: now.toISODate()!,
  }
}

/**
 * Bornes SQL d'une période, dans le fuseau de l'application : début du premier
 * jour (inclus) et début du lendemain du dernier jour (exclu).
 */
export function dateRangeBounds(range: ActivityDateRange): { start: string; end: string } {
  return {
    start: DateTime.fromISO(range.from).startOf('day').toSQL()!,
    end: DateTime.fromISO(range.to).plus({ days: 1 }).startOf('day').toSQL()!,
  }
}

/**
 * Début des événements encore rattachés à une organisation dans la période :
 * au-delà de 90 jours, l'événement est pseudonymisé (il compte dans les totaux
 * mais ne nomme plus personne). Le plus tardif du début de période et de ce
 * seuil, même si la purge nocturne n'est pas encore passée.
 */
export function identifiableSince(range: ActivityDateRange, now: DateTime): string {
  const start = DateTime.fromISO(range.from).startOf('day')
  const threshold = now.minus({ days: ACTIVITY_EVENT_PSEUDONYMIZE_AFTER_DAYS })
  return (start > threshold ? start : threshold).toSQL()!
}

/**
 * Ajoute à chaque ligne le nom de sa cible, résolu avec le repli habituel
 * (`resolveTranslation`) ; `#<id>` quand la cible n'a aucune traduction.
 */
export function nameTargets<T extends Pick<ActivityTargetCount, 'targetId'>>(
  rows: readonly T[],
  translations: readonly ActivityTargetTranslation[],
  locale: string
): (T & { name: string })[] {
  const byTarget = Map.groupBy(translations, (translation) => translation.targetId)
  return rows.map((row) => ({
    ...row,
    name: resolveTranslation(byTarget.get(row.targetId), locale)?.name ?? `#${row.targetId}`,
  }))
}

/** Ligne brute de `product_translations` / `supplier_translations` (clé aliasée `target_id`). */
export function toTargetTranslation(row: Record<string, unknown>): ActivityTargetTranslation {
  return { targetId: Number(row.target_id), locale: String(row.locale), name: String(row.name) }
}
