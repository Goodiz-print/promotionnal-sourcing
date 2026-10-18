import { test } from '@japa/runner'
import { ImportJobFactory } from '#database/factories/import_job_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import ImportJobService from '#services/import_job_service'
import { ImportJobStateException } from '#exceptions/import_errors'
import { IMPORT_MAX_STORED_ERRORS } from '#shared/types/import_job'
import { useDatabase } from '#tests/utils/setup'

test.group('Imports en masse', (group) => {
  useDatabase(group)

  test('cycle nominal : pending → running → completed', async ({ assert }) => {
    const organization = await OrganizationFactory.create()
    const user = await UserFactory.create()
    const service = new ImportJobService()

    const job = await service.create({ organization, createdBy: user, kind: 'products_csv' })
    assert.equal(job.status, 'pending')

    await service.start(job, 2)
    await service.recordRow(job, 1)
    await service.recordRow(job, 2)
    await service.complete(job)

    await job.refresh()
    assert.equal(job.status, 'completed')
    assert.equal(job.totalRows, 2)
    assert.equal(job.processedRows, 2)
    assert.equal(job.errorCount, 0)
    assert.isNotNull(job.finishedAt)
  })

  test('les erreurs de ligne sont comptées, et seules les premières sont conservées', async ({
    assert,
  }) => {
    const organization = await OrganizationFactory.create()
    const user = await UserFactory.create()
    const service = new ImportJobService()
    const job = await service.create({ organization, createdBy: user, kind: 'products_csv' })
    await service.start(job, IMPORT_MAX_STORED_ERRORS + 5)

    for (let row = 1; row <= IMPORT_MAX_STORED_ERRORS + 5; row++) {
      await service.recordRow(job, row, `ligne ${row} invalide`)
    }

    await job.refresh()
    assert.equal(job.errorCount, IMPORT_MAX_STORED_ERRORS + 5)
    assert.lengthOf(job.errors, IMPORT_MAX_STORED_ERRORS)
    assert.equal(job.errors[0].row, 1)
  })

  test('une transition interdite lève ImportJobStateException sans modifier le job', async ({
    assert,
  }) => {
    const organization = await OrganizationFactory.create()
    const job = await ImportJobFactory.merge({ organizationId: organization.id }).create()

    await assert.rejects(() => new ImportJobService().complete(job), ImportJobStateException)
    await job.refresh()
    assert.equal(job.status, 'pending')
  })

  test('fail consigne le motif sur la ligne 0 et interdit un second échec', async ({ assert }) => {
    const organization = await OrganizationFactory.create()
    const user = await UserFactory.create()
    const service = new ImportJobService()
    const job = await service.create({ organization, createdBy: user, kind: 'suppliers_csv' })

    await service.fail(job, 'Encodage non reconnu')

    assert.equal(job.status, 'failed')
    assert.equal(job.errors[0].row, 0)
    assert.equal(job.errors[0].message, 'Encodage non reconnu')
    await assert.rejects(() => service.fail(job, 'encore'), ImportJobStateException)
  })

  test('la fabrique couvre les états running, completed et failed', async ({ assert }) => {
    const organization = await OrganizationFactory.create()
    const running = await ImportJobFactory.merge({ organizationId: organization.id })
      .apply('running')
      .create()
    const failed = await ImportJobFactory.merge({ organizationId: organization.id })
      .apply('failed')
      .create()

    assert.equal(running.status, 'running')
    assert.equal(failed.status, 'failed')
    assert.isAbove(failed.errorCount, 0)
  })
})
