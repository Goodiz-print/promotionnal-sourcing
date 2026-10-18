import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import ImportJob from '#models/import_job'
import Organization from '#models/organization'
import User from '#models/user'
import { ImportJobStateException } from '#exceptions/import_errors'
import { csvLine } from '#shared/helpers/csv'
import {
  IMPORT_ERROR_CSV_HEADER,
  IMPORT_MAX_STORED_ERRORS,
  type ImportKind,
  type ImportRowError,
} from '#shared/types/import_job'

interface CreateInput {
  organization: Organization
  createdBy: User
  kind: ImportKind
  sourceStorageObjectId?: number | null
}

/**
 * Cycle de vie d'un import en masse (#49, #77). Chaque transition vérifie le
 * statut courant : un import ne passe jamais à un état incohérent.
 *
 * Les lignes sont traitées par l'appelant (job de queue) qui appelle
 * `recordRow` pour chaque ligne. Les écritures sont unitaires, ce qui reste
 * simple tant que les volumes restent modérés ; un import de plusieurs
 * dizaines de milliers de lignes demandera un remplissage par lots.
 */
@inject()
export default class ImportJobService {
  async create(input: CreateInput): Promise<ImportJob> {
    return ImportJob.create({
      organizationId: input.organization.id,
      createdByUserId: input.createdBy.id,
      kind: input.kind,
      status: 'pending',
      sourceStorageObjectId: input.sourceStorageObjectId ?? null,
      totalRows: 0,
      processedRows: 0,
      errorCount: 0,
      errors: [],
    })
  }

  /** `pending` → `running`, avec le nombre total de lignes connu. */
  async start(job: ImportJob, totalRows: number): Promise<ImportJob> {
    this.assertStatus(job, ['pending'], 'start')
    job.merge({ status: 'running', totalRows, startedAt: DateTime.now() })
    return job.save()
  }

  /**
   * Comptabilise une ligne traitée. `error` est renseigné si la ligne a échoué.
   * Les erreurs sont bornées à `IMPORT_MAX_STORED_ERRORS` ; `errorCount` reste exact.
   */
  async recordRow(
    job: ImportJob,
    row: number,
    error?: Omit<ImportRowError, 'row'>
  ): Promise<ImportJob> {
    this.assertStatus(job, ['running'], 'record')
    job.processedRows += 1
    if (error !== undefined) {
      job.errorCount += 1
      if (job.errors.length < IMPORT_MAX_STORED_ERRORS) {
        job.errors = [...job.errors, { row, ...error }]
      }
    }
    return job.save()
  }

  /**
   * Export CSV des erreurs stockées (v1) : séparateur `;`, en-tête
   * `ligne;colonne;message;valeur_recue`. Ne contient que les erreurs conservées
   * (100 au plus) ; `errorCount` indique le total réel.
   */
  errorsToCsv(job: ImportJob): string {
    const lines = [csvLine([...IMPORT_ERROR_CSV_HEADER])]
    for (const error of job.errors) {
      lines.push(csvLine([error.row, error.column ?? '', error.message, error.receivedValue ?? '']))
    }
    return lines.join('\r\n')
  }

  /** `running` → `completed`. */
  async complete(job: ImportJob): Promise<ImportJob> {
    this.assertStatus(job, ['running'], 'complete')
    job.merge({ status: 'completed', finishedAt: DateTime.now() })
    return job.save()
  }

  /**
   * `pending` | `running` → `failed`. Le motif est consigné comme erreur de
   * ligne 0 (le fichier entier), pour ne pas avoir de champ à part.
   */
  async fail(job: ImportJob, reason: string): Promise<ImportJob> {
    this.assertStatus(job, ['pending', 'running'], 'fail')
    const entry: ImportRowError = { row: 0, message: reason }
    job.merge({
      status: 'failed',
      finishedAt: DateTime.now(),
      errors: job.errors.length < IMPORT_MAX_STORED_ERRORS ? [...job.errors, entry] : job.errors,
      errorCount: job.errorCount + 1,
    })
    return job.save()
  }

  private assertStatus(job: ImportJob, allowed: string[], action: string): void {
    if (!allowed.includes(job.status)) {
      throw new ImportJobStateException(`Cannot ${action} an import in status "${job.status}"`)
    }
  }
}
