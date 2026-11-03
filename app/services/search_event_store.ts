import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import {
  SEARCH_EVENT_DEDUPE_SECONDS,
  SEARCH_EVENT_PSEUDONYMISE_AFTER_DAYS,
  SEARCH_EVENT_RETENTION_DAYS,
  type SearchEventPayload,
} from '#shared/types/search_event'

/**
 * Écriture, dédoublonnage et rétention du journal des recherches (#171).
 *
 * Injecté dans les jobs `RecordSearchEventJob` et `PurgeSearchEventsJob`, chargés
 * au boot : pas d'import de modèle Lucid (d'où `db`), et pas d'import d'un job
 * (sinon cycle avec `SearchEventService`, qui dispatche le job).
 */
export default class SearchEventStore {
  /**
   * Écrit l'événement, sauf si le même utilisateur vient d'enregistrer la même
   * recherche (rechargement, retour arrière). Un visiteur anonyme n'est pas
   * dédoublonné : rien ne permet de savoir si c'est la même personne.
   */
  async persist(event: SearchEventPayload): Promise<boolean> {
    if (event.userId !== null && (await this.isRepeat(event))) return false

    await db.table('search_events').insert({
      source: event.source,
      query: event.query,
      filters: JSON.stringify(event.filters),
      category_id: event.categoryId,
      mode: event.mode,
      results_count: event.resultsCount,
      zero_results: event.resultsCount === 0,
      user_id: event.userId,
      organization_id: event.organizationId,
      locale: event.locale,
    })
    return true
  }

  /**
   * RGPD : détache les événements de plus de 90 jours de leur utilisateur, puis
   * supprime ceux de plus de 24 mois.
   */
  async purge(now: DateTime = DateTime.now()): Promise<{ pseudonymised: number; deleted: number }> {
    const pseudonymised = await db
      .from('search_events')
      .whereNotNull('user_id')
      .where(
        'created_at',
        '<',
        now.minus({ days: SEARCH_EVENT_PSEUDONYMISE_AFTER_DAYS }).toJSDate()
      )
      .update({ user_id: null })
    const deleted = await db
      .from('search_events')
      .where('created_at', '<', now.minus({ days: SEARCH_EVENT_RETENTION_DAYS }).toJSDate())
      .delete()

    return { pseudonymised: Number(pseudonymised), deleted: Number(deleted) }
  }

  private async isRepeat(event: SearchEventPayload): Promise<boolean> {
    const since = DateTime.now().minus({ seconds: SEARCH_EVENT_DEDUPE_SECONDS }).toJSDate()
    const query = db
      .from('search_events')
      .where('user_id', event.userId!)
      .where('source', event.source)
      .where('created_at', '>=', since)
      .whereRaw('filters = ?::jsonb', [JSON.stringify(event.filters)])
    if (event.query === null) query.whereNull('query')
    else query.where('query', event.query)
    if (event.categoryId === null) query.whereNull('category_id')
    else query.where('category_id', event.categoryId)

    return (await query.first()) !== null
  }
}
