import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import RunImportJob from '#jobs/run_import_job'
import AdminAuditService from '#services/admin_audit_service'
import ImportRunner from '#services/import_runner'
import { AdminImportNotFoundException } from '#exceptions/admin_errors'
import { csvLine } from '#shared/helpers/csv'
import type { AdminActionContext } from '#shared/types/admin_audit'
import {
  IMPORT_STALE_MINUTES,
  type AdminImportDbRow,
  type AdminImportDetail,
  type AdminImportFilters,
  type AdminImportRow,
} from '#shared/types/admin_import'
import {
  IMPORT_ERROR_CSV_HEADER,
  type ImportKind,
  type ImportRowError,
  type ImportStatus,
} from '#shared/types/import_job'
import type { Paginated } from '#shared/types/pagination'

const iso = (value: Date | string): string => new Date(value).toISOString()

/** Échappe les jokers `LIKE` : le terme saisi est cherché tel quel. */
const contains = (term: string) => `%${term.replace(/[\\%_]/g, '\\$&')}%`

const staleBefore = () => new Date(Date.now() - IMPORT_STALE_MINUTES * 60_000)

/**
 * Imports en masse vus du back-office (#170) : suivi, erreurs, export CSV des
 * erreurs et relance. La relance crée un nouvel import (l'historique n'est pas
 * réécrit) traité par `RunImportJob`.
 */
@inject()
export default class AdminImportService {
  constructor(
    private audit: AdminAuditService,
    private runner: ImportRunner
  ) {}

  async list(
    filters: AdminImportFilters & { page: number; perPage: number }
  ): Promise<Paginated<AdminImportRow>> {
    const query = this.baseQuery(db.connection())
    if (filters.status) query.where('j.status', filters.status)
    if (filters.kind) query.where('j.kind', filters.kind)
    if (filters.organization) query.whereRaw('o.name ILIKE ?', [contains(filters.organization)])

    const paginator = await query
      .orderBy('j.created_at', 'desc')
      .orderBy('j.id', 'desc')
      .paginate(filters.page, filters.perPage)

    const { data, meta } = paginator.toJSON()
    return {
      data: data.map((row: AdminImportDbRow) => this.present(row)),
      meta: {
        total: meta.total,
        perPage: meta.perPage,
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
      },
    }
  }

  async show(id: number): Promise<AdminImportDetail> {
    const row: AdminImportDbRow | undefined = await this.baseQuery(db.connection())
      .where('j.id', id)
      .first()
    if (!row) throw new AdminImportNotFoundException()
    return {
      ...this.present(row),
      errors: this.parseErrors(row.errors).map((error) => ({
        row: error.row,
        message: error.message,
        column: error.column ?? null,
        receivedValue: error.receivedValue ?? null,
      })),
      hasSourceFile: row.source_storage_object_id !== null,
    }
  }

  /**
   * Relance un import échoué, ou resté bloqué (`pending` / `running` depuis plus
   * de `IMPORT_STALE_MINUTES`). Retourne l'identifiant du nouvel import, ou
   * `null` si l'import n'est pas relançable (état, ou déjà relancé).
   */
  async retry(importJobId: number, context: AdminActionContext): Promise<number | null> {
    const newId = await db.transaction(async (trx) => {
      const original: AdminImportDbRow | undefined = await this.baseQuery(trx)
        .where('j.id', importJobId)
        .forUpdate()
        .first()
      if (!original) throw new AdminImportNotFoundException()
      if (!this.isRetryable(original)) return null

      // Un import perdu en cours de route est clos avant d'être remplacé.
      if (original.status !== 'failed') {
        await this.closeLost(trx, original)
      }

      const [created] = await trx
        .table('import_jobs')
        .insert({
          organization_id: original.organization_id,
          created_by_user_id: context.actor?.id ?? null,
          kind: original.kind,
          status: 'pending',
          source_storage_object_id: original.source_storage_object_id,
          retry_of_import_id: original.id,
          total_rows: 0,
          processed_rows: 0,
          error_count: 0,
          errors: '[]',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')

      await this.audit.record(
        {
          action: 'import.retried',
          targetType: 'import_job',
          targetId: created.id,
          changes: { after: { retryOf: original.id, kind: original.kind } },
        },
        { ...context, client: trx }
      )
      return created.id as number
    })

    if (newId !== null) await this.enqueue(newId)
    return newId
  }

  /**
   * Export CSV des erreurs conservées (v1, en-tête `IMPORT_ERROR_CSV_HEADER`).
   * Ces lignes reprennent des valeurs saisies par le fournisseur : l'export est
   * tracé dans l'audit, dans la même transaction que la lecture.
   */
  async errorsCsv(
    importJobId: number,
    context: AdminActionContext
  ): Promise<{ filename: string; csv: string }> {
    return db.transaction(async (trx) => {
      const row: AdminImportDbRow | undefined = await this.baseQuery(trx)
        .where('j.id', importJobId)
        .first()
      if (!row) throw new AdminImportNotFoundException()

      const errors = this.parseErrors(row.errors)
      await this.audit.record(
        {
          action: 'import.errors_exported',
          targetType: 'import_job',
          targetId: importJobId,
          changes: { after: { rows: errors.length } },
        },
        { ...context, client: trx }
      )

      const lines = [csvLine([...IMPORT_ERROR_CSV_HEADER])]
      for (const error of errors) {
        lines.push(
          csvLine([error.row, error.column ?? '', error.message, error.receivedValue ?? ''])
        )
      }
      return { filename: `import-${importJobId}-erreurs.csv`, csv: lines.join('\r\n') }
    })
  }

  /** Met le traitement en queue ; si elle est indisponible, l'import est clos en échec et reste relançable. */
  private async enqueue(importJobId: number): Promise<void> {
    try {
      await RunImportJob.dispatch({ importJobId })
    } catch (error) {
      await this.runner.fail(importJobId, "La mise en file d'attente a échoué.")
      throw error
    }
  }

  private async closeLost(trx: QueryClientContract, original: AdminImportDbRow): Promise<void> {
    const errors = this.parseErrors(original.errors)
    await trx
      .from('import_jobs')
      .where('id', original.id)
      .update({
        status: 'failed',
        finished_at: new Date(),
        updated_at: new Date(),
        error_count: original.error_count + 1,
        errors: JSON.stringify([
          ...errors,
          { row: 0, message: "Import interrompu : aucun traitement n'a abouti." },
        ]),
      })
  }

  private baseQuery(client: QueryClientContract) {
    return client
      .from('import_jobs as j')
      .join('organizations as o', 'o.id', 'j.organization_id')
      .leftJoin('users as u', 'u.id', 'j.created_by_user_id')
      .select(
        'j.id',
        'j.kind',
        'j.status',
        'j.total_rows',
        'j.processed_rows',
        'j.error_count',
        'j.errors',
        'j.organization_id',
        'o.name as organization_name',
        'u.email as creator_email',
        'j.retry_of_import_id',
        'j.source_storage_object_id',
        'j.started_at',
        'j.finished_at',
        'j.created_at',
        db.raw(
          '(select r.id from import_jobs r where r.retry_of_import_id = j.id order by r.id desc limit 1) as retried_by_import_id'
        )
      )
  }

  private isRetryable(row: AdminImportDbRow): boolean {
    if (row.retried_by_import_id !== null) return false
    if (row.status === 'failed') return true
    if (row.status !== 'pending' && row.status !== 'running') return false
    return new Date(row.started_at ?? row.created_at) < staleBefore()
  }

  private parseErrors(raw: ImportRowError[] | string): ImportRowError[] {
    return typeof raw === 'string' ? (JSON.parse(raw) as ImportRowError[]) : raw
  }

  private present(row: AdminImportDbRow): AdminImportRow {
    return {
      id: row.id,
      kind: row.kind as ImportKind,
      status: row.status as ImportStatus,
      totalRows: row.total_rows,
      processedRows: row.processed_rows,
      errorCount: row.error_count,
      organization: { id: row.organization_id, name: row.organization_name },
      createdBy: row.creator_email,
      retryOfId: row.retry_of_import_id,
      retriedById: row.retried_by_import_id,
      retryable: this.isRetryable(row),
      startedAt: row.started_at ? iso(row.started_at) : null,
      finishedAt: row.finished_at ? iso(row.finished_at) : null,
      createdAt: iso(row.created_at),
    }
  }
}
