import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import RecordSearchEventJob from '#jobs/record_search_event_job'
import SearchEvent from '#models/search_event'
import { normalizeSearchTerm } from '#shared/helpers/search_event'
import {
  SEARCH_EVENT_PSEUDONYMIZE_AFTER_DAYS,
  SEARCH_EVENT_RETENTION_DAYS,
  type SearchEventInput,
  type SearchEventPayload,
  type SearchEventPurgeResult,
} from '#shared/types/search_event'

/**
 * Journal des recherches des clients (#171) : ce qu'ils cherchent, avec quels
 * filtres, et ce qu'ils ont obtenu. Alimente le monitoring de la demande.
 *
 * `record` ne bloque jamais la recherche : la mise en queue est asynchrone et
 * toute erreur est loggée sans être propagée. Une page sans terme, catégorie
 * ni filtre (simple navigation) n'est pas enregistrée.
 */
@inject()
export default class SearchEventService {
  async record(input: SearchEventInput): Promise<void> {
    const term = normalizeSearchTerm(input.term)
    if (!term && !input.categoryId && Object.keys(input.filters).length === 0) return

    try {
      const payload: SearchEventPayload = {
        ...input,
        term,
        searchedAt: DateTime.now().toISO()!,
      }
      await RecordSearchEventJob.dispatch(payload)
    } catch (error) {
      logger.warn({ err: error, source: input.source }, 'failed to queue search event')
    }
  }

  /** Écriture effective, appelée par le job. Ajout seul. */
  async store(payload: SearchEventPayload): Promise<SearchEvent> {
    return SearchEvent.create({
      source: payload.source,
      term: payload.term,
      filters: payload.filters,
      categoryId: payload.categoryId,
      mode: payload.mode,
      resultsCount: payload.resultsCount,
      userId: payload.userId,
      organizationId: payload.organizationId,
      locale: payload.locale,
      createdAt: DateTime.fromISO(payload.searchedAt),
    })
  }

  /**
   * Politique de rétention : détache l'utilisateur et l'organisation après
   * `SEARCH_EVENT_PSEUDONYMIZE_AFTER_DAYS`, supprime l'événement après
   * `SEARCH_EVENT_RETENTION_DAYS`. Idempotent.
   */
  async purge(now: DateTime = DateTime.now()): Promise<SearchEventPurgeResult> {
    const pseudonymizeBefore = now.minus({ days: SEARCH_EVENT_PSEUDONYMIZE_AFTER_DAYS }).toSQL()!
    const deleteBefore = now.minus({ days: SEARCH_EVENT_RETENTION_DAYS }).toSQL()!

    return db.transaction(async (trx) => {
      const deleted = await SearchEvent.query({ client: trx })
        .where('createdAt', '<', deleteBefore)
        .delete()
      const pseudonymized = await SearchEvent.query({ client: trx })
        .where('createdAt', '<', pseudonymizeBefore)
        .where((query) => query.whereNotNull('userId').orWhereNotNull('organizationId'))
        .update({ userId: null, organizationId: null })

      return {
        deleted: Number(deleted),
        pseudonymized: Number(pseudonymized),
      }
    })
  }
}
