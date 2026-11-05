import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { IMPORT_MAX_STORED_ERRORS, type ImportRowError } from '#shared/types/import_job'

/** Motif consigné quand aucun traitement n'est branché pour le type d'import. */
export const IMPORT_NO_PROCESSOR_MESSAGE =
  "Aucun traitement n'est disponible pour ce type d'import (en attente du moteur d'import, #77)."

/**
 * Exécute un import en masse hors de la requête (#170). Le moteur qui lit
 * le fichier source et crée les produits ou fournisseurs relève de #77 : tant
 * qu'il n'est pas branché, l'import est clos en échec avec un motif explicite,
 * jamais laissé en attente.
 *
 * Écritures directes avec `db` (pas de modèle Lucid) : le job qui l'appelle
 * est chargé au boot de la queue (cf. CLAUDE.md).
 */
@inject()
export default class ImportRunner {
  async run(importJobId: number): Promise<void> {
    const job: { id: number; status: string } | undefined = await db
      .from('import_jobs')
      .where('id', importJobId)
      .select('id', 'status')
      .first()
    // Rejouable : un import déjà pris en charge ou terminé n'est pas retraité.
    if (!job || job.status !== 'pending') return

    logger.warn({ importJobId }, 'no import processor available')
    await this.fail(importJobId, IMPORT_NO_PROCESSOR_MESSAGE)
  }

  /** `pending` | `running` → `failed`, avec le motif en erreur de ligne 0 (le fichier entier). */
  async fail(importJobId: number, reason: string): Promise<boolean> {
    return db.transaction(async (trx) => {
      const job: { errors: ImportRowError[] | string; error_count: number } | undefined = await trx
        .from('import_jobs')
        .where('id', importJobId)
        .whereIn('status', ['pending', 'running'])
        .select('errors', 'error_count')
        .forUpdate()
        .first()
      if (!job) return false

      const errors: ImportRowError[] =
        typeof job.errors === 'string' ? JSON.parse(job.errors) : job.errors
      const entry: ImportRowError = { row: 0, message: reason }
      await trx
        .from('import_jobs')
        .where('id', importJobId)
        .update({
          status: 'failed',
          finished_at: new Date(),
          updated_at: new Date(),
          error_count: job.error_count + 1,
          errors: JSON.stringify(
            errors.length < IMPORT_MAX_STORED_ERRORS ? [...errors, entry] : errors
          ),
        })
      return true
    })
  }
}
