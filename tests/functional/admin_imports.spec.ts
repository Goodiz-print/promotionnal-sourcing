import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { ImportJobFactory } from '#database/factories/import_job_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import AdminAuditLog from '#models/admin_audit_log'
import { IMPORT_NO_PROCESSOR_MESSAGE } from '#services/import_runner'
import { useDatabase } from '#tests/utils/setup'
import type { AdminImportDetail, AdminImportRow } from '#shared/types/admin_import'

/**
 * Suivi des imports (#170). `QUEUE_DRIVER=sync` en test : `RunImportJob` s'exécute
 * dans la requête de relance, donc le nouvel import est déjà clos à la réponse
 * (aucun moteur d'import n'est branché avant #77).
 */
function retry(client: any, user: unknown, id: number) {
  return client
    .post(`/fr/admin/imports/${id}/retry`)
    .json({})
    .redirects(0)
    .withCsrfToken()
    .header('Accept', 'application/json')
    .loginAs(user)
}

test.group('Imports — administration', (group) => {
  useDatabase(group)

  test('refuse l’accès sans le droit, y compris au support et au modérateur', async ({
    client,
  }) => {
    const organization = await OrganizationFactory.create()
    const job = await ImportJobFactory.apply('failed')
      .merge({ organizationId: organization.id })
      .create()
    for (const state of ['platformModerator', 'platformSupport', 'platformAnalyst'] as const) {
      const user = await UserFactory.apply(state).create()
      const list = await client.get('/fr/admin/imports').withInertia().loginAs(user)
      const show = await client.get(`/fr/admin/imports/${job.id}`).withInertia().loginAs(user)
      const errors = await client.get(`/fr/admin/imports/${job.id}/errors`).loginAs(user)
      const retried = await retry(client, user, job.id)
      for (const response of [list, show, errors, retried]) response.assertStatus(403)
    }
  })

  test('liste les imports et filtre par statut, type et organisation', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const acme = await OrganizationFactory.merge({ name: 'Acme Goodies' }).create()
    const other = await OrganizationFactory.merge({ name: 'Zeta 100%' }).create()
    await ImportJobFactory.merge({ organizationId: acme.id }).apply('failed').create()
    await ImportJobFactory.merge({ organizationId: acme.id, kind: 'suppliers_csv' })
      .apply('completed')
      .create()
    await ImportJobFactory.merge({ organizationId: other.id }).apply('running').create()

    const all = await client.get('/fr/admin/imports').withInertia().loginAs(admin)
    all.assertStatus(200)
    assert.equal(all.inertiaProps.imports.meta.total, 3)

    const failed = await client.get('/fr/admin/imports?status=failed').withInertia().loginAs(admin)
    assert.deepEqual(
      (failed.inertiaProps.imports.data as AdminImportRow[]).map((r) => r.status),
      ['failed']
    )

    const suppliers = await client
      .get('/fr/admin/imports?kind=suppliers_csv')
      .withInertia()
      .loginAs(admin)
    assert.equal(suppliers.inertiaProps.imports.meta.total, 1)

    const byOrganization = await client
      .get('/fr/admin/imports?organization=acme')
      .withInertia()
      .loginAs(admin)
    assert.equal(byOrganization.inertiaProps.imports.meta.total, 2)

    // Les jokers LIKE saisis sont cherchés tels quels.
    const wildcard = await client
      .get('/fr/admin/imports?organization=%25')
      .withInertia()
      .loginAs(admin)
    assert.equal(wildcard.inertiaProps.imports.meta.total, 1)

    const invalid = await client.get('/fr/admin/imports?status=nope').withInertia().loginAs(admin)
    invalid.assertStatus(422)
  })

  test('la fiche expose la progression et les erreurs', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.create()
    const job = await ImportJobFactory.merge({
      organizationId: organization.id,
      errors: [{ row: 3, column: 'prix', message: 'Prix invalide', receivedValue: 'abc' }],
      errorCount: 1,
    })
      .apply('failed')
      .create()

    const response = await client.get(`/fr/admin/imports/${job.id}`).withInertia().loginAs(admin)

    response.assertStatus(200)
    const detail = response.inertiaProps.importJob as AdminImportDetail
    assert.equal(detail.status, 'failed')
    assert.isTrue(detail.retryable)
    assert.deepEqual(detail.errors, [
      { row: 3, column: 'prix', message: 'Prix invalide', receivedValue: 'abc' },
    ])

    const missing = await client.get('/fr/admin/imports/999999').withInertia().loginAs(admin)
    missing.assertStatus(404)
  })

  test('relance un import échoué : nouvel import tracé dans l’audit, relancé une seule fois', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.create()
    const original = await ImportJobFactory.apply('failed')
      .merge({ organizationId: organization.id })
      .create()

    await retry(client, admin, original.id)

    const created = await db.from('import_jobs').where('retry_of_import_id', original.id).first()
    assert.exists(created)
    assert.equal(created.organization_id, organization.id)
    assert.equal(created.kind, original.kind)
    // Sync : le moteur n'existe pas encore, l'import est clos avec un motif explicite.
    assert.equal(created.status, 'failed')
    assert.equal(created.errors[0].message, IMPORT_NO_PROCESSOR_MESSAGE)

    const logs = await AdminAuditLog.query().where('action', 'import.retried')
    assert.lengthOf(logs, 1)
    assert.equal(logs[0].targetId, created.id)

    // L'original est déjà relancé : une seconde relance est ignorée.
    await retry(client, admin, original.id)
    assert.lengthOf(await db.from('import_jobs').where('retry_of_import_id', original.id), 1)
    assert.lengthOf(await AdminAuditLog.query().where('action', 'import.retried'), 1)

    const list = await client.get('/fr/admin/imports').withInertia().loginAs(admin)
    const rows = list.inertiaProps.imports.data as AdminImportRow[]
    const originalRow = rows.find((r) => r.id === original.id)!
    assert.equal(originalRow.retriedById, created.id)
    assert.isFalse(originalRow.retryable)
  })

  test('ne relance pas un import terminé ou récent en cours', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.create()
    const completed = await ImportJobFactory.merge({ organizationId: organization.id })
      .apply('completed')
      .create()
    const running = await ImportJobFactory.merge({ organizationId: organization.id })
      .apply('running')
      .create()

    await retry(client, admin, completed.id)
    await retry(client, admin, running.id)

    assert.lengthOf(await db.from('import_jobs').whereNotNull('retry_of_import_id'), 0)
    assert.lengthOf(await AdminAuditLog.query().where('action', 'import.retried'), 0)
  })

  test('un import resté bloqué trop longtemps est clos puis relançable', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.create()
    const stuck = await ImportJobFactory.apply('running')
      .merge({ organizationId: organization.id, startedAt: DateTime.now().minus({ hours: 3 }) })
      .create()

    const list = await client.get('/fr/admin/imports').withInertia().loginAs(admin)
    assert.isTrue((list.inertiaProps.imports.data as AdminImportRow[])[0].retryable)

    await retry(client, admin, stuck.id)

    const closed = await db.from('import_jobs').where('id', stuck.id).first()
    assert.equal(closed.status, 'failed')
    assert.isNotNull(closed.finished_at)
    assert.lengthOf(await db.from('import_jobs').where('retry_of_import_id', stuck.id), 1)
  })

  test('exporte les erreurs en CSV et trace l’export', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.create()
    const job = await ImportJobFactory.apply('failed')
      .merge({
        organizationId: organization.id,
        errorCount: 2,
        errors: [
          { row: 2, column: 'nom', message: 'Obligatoire' },
          { row: 5, column: 'prix', message: 'Prix invalide', receivedValue: '=1+1' },
        ],
      })
      .create()

    const response = await client.get(`/fr/admin/imports/${job.id}/errors`).loginAs(admin)

    response.assertStatus(200)
    assert.include(response.header('content-type'), 'text/csv')
    assert.include(response.header('content-disposition'), `import-${job.id}-erreurs.csv`)
    const lines = response.text().split('\r\n')
    assert.equal(lines[0], 'ligne;colonne;message;valeur_recue')
    assert.equal(lines[1], '2;nom;Obligatoire;')
    // Une valeur commençant par « = » est neutralisée contre l'injection de formule.
    assert.equal(lines[2], "5;prix;Prix invalide;'=1+1")
    assert.lengthOf(await AdminAuditLog.query().where('action', 'import.errors_exported'), 1)
  })
})
