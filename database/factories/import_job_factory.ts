import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import ImportJob from '#models/import_job'

/**
 * Import en attente, sans fichier. `organizationId` est à fournir par l'appelant.
 */
export const ImportJobFactory = factory
  .define(ImportJob, () => ({
    kind: 'products_csv' as const,
    status: 'pending' as const,
    sourceStorageObjectId: null,
    totalRows: 0,
    processedRows: 0,
    errorCount: 0,
    errors: [],
  }))
  .state('running', (job) => {
    job.status = 'running'
    job.totalRows = 10
    job.startedAt = DateTime.now()
  })
  .state('completed', (job) => {
    job.status = 'completed'
    job.totalRows = 10
    job.processedRows = 10
    job.startedAt = DateTime.now().minus({ minutes: 5 })
    job.finishedAt = DateTime.now()
  })
  .state('failed', (job) => {
    job.status = 'failed'
    job.errorCount = 1
    job.errors = [{ row: 0, message: 'Fichier illisible' }]
    job.startedAt = DateTime.now().minus({ minutes: 5 })
    job.finishedAt = DateTime.now()
  })
  .build()
