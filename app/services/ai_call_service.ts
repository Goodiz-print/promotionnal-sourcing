import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { AI_CALL_RETENTION_DAYS, type AiCallRecord } from '#shared/types/ai'

/** Longueur maximale du message d'erreur conservé (jamais le contenu des prompts). */
const MAX_ERROR_LENGTH = 500

/**
 * Journal des appels IA (#177). `record()` ne lève jamais : perdre une ligne de
 * journal ne doit ni faire échouer une traduction, ni la rejouer (et la refacturer).
 * Accès par `db` : utilisé depuis un job (pas de modèle Lucid).
 */
export default class AiCallService {
  async record(call: AiCallRecord): Promise<void> {
    try {
      await db.table('ai_calls').insert({
        service: call.service,
        model: call.model,
        entity: call.entity,
        entity_id: call.entityId,
        source_locale: call.sourceLocale,
        target_locales: JSON.stringify(call.targetLocales),
        prompt_tokens: call.usage.promptTokens,
        completion_tokens: call.usage.completionTokens,
        duration_ms: call.durationMs,
        status: call.status,
        error: call.error ? call.error.slice(0, MAX_ERROR_LENGTH) : null,
        created_at: new Date(),
      })
    } catch (error) {
      logger.warn(
        { err: error, entity: call.entity, entityId: call.entityId },
        'ai call not logged'
      )
    }
  }

  /** Supprime les appels plus vieux que la rétention ; retourne le nombre de lignes supprimées. */
  async purge(now: Date = new Date()): Promise<number> {
    const limit = new Date(now.getTime() - AI_CALL_RETENTION_DAYS * 86_400_000)
    const deleted = await db.from('ai_calls').where('created_at', '<', limit).delete()
    return Number(deleted)
  }
}
