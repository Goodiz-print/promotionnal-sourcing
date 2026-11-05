import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { LegalConsentFactory } from '#database/factories/legal_consent_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import AdminAuditLog from '#models/admin_audit_log'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import { CURRENT_LEGAL_VERSION } from '#shared/types/legal'
import type { AdminConsentRow } from '#shared/types/admin_consent'

/** Consentements légaux (#168) : consultation, filtres, export de preuve tracé. */
test.group('Consentements — administration', (group) => {
  useDatabase(group)

  test('liste les consentements avec la version, la date et l’IP', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.create()
    const signer = await createMember(organization)
    await LegalConsentFactory.merge({
      organizationId: organization.id,
      userId: signer.id,
      ipAddress: '198.51.100.4',
    }).create()

    const response = await client.get('/fr/admin/consents').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/consents/index')
    const [row] = response.inertiaProps.consents.data as AdminConsentRow[]
    assert.equal(row.organization.id, organization.id)
    assert.equal(row.user?.email, signer.email)
    assert.equal(row.ipAddress, '198.51.100.4')
    assert.equal(row.version, CURRENT_LEGAL_VERSION)
    assert.isFalse(row.outdated)
  })

  test('signale les versions dépassées et filtre dessus', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.create()
    await LegalConsentFactory.merge({ organizationId: organization.id }).create()
    const old = await LegalConsentFactory.merge({
      organizationId: organization.id,
      version: '2025-01-01',
    }).create()
    // Un consentement retiré n'est pas « à re-signer ».
    await LegalConsentFactory.merge({
      organizationId: organization.id,
      version: '2024-01-01',
      revokedAt: DateTime.now(),
    }).create()

    const response = await client.get('/fr/admin/consents?outdated=1').withInertia().loginAs(admin)

    const rows = response.inertiaProps.consents.data as AdminConsentRow[]
    assert.deepEqual(
      rows.map((row) => row.id),
      [old.id]
    )
    assert.isTrue(rows[0].outdated)
    assert.equal(response.inertiaProps.overview.outdatedCount, 1)
    assert.equal(response.inertiaProps.overview.currentVersion, CURRENT_LEGAL_VERSION)
  })

  test('filtre par organisation, type et signataire', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const acme = await OrganizationFactory.merge({ name: 'Acme Agency' }).create()
    const other = await OrganizationFactory.merge({ name: 'Autre' }).create()
    const signer = await createMember(acme)
    const wanted = await LegalConsentFactory.merge({
      organizationId: acme.id,
      userId: signer.id,
      kind: 'data_license',
    }).create()
    await LegalConsentFactory.merge({ organizationId: acme.id, kind: 'terms' }).create()
    await LegalConsentFactory.merge({ organizationId: other.id, kind: 'data_license' }).create()

    const response = await client
      .get(`/fr/admin/consents?organization=acme&kind=data_license&user=${signer.email}`)
      .withInertia()
      .loginAs(admin)

    const rows = response.inertiaProps.consents.data as AdminConsentRow[]
    assert.deepEqual(
      rows.map((row) => row.id),
      [wanted.id]
    )
  })

  test('refuse l’accès sans le droit d’audit', async ({ client }) => {
    const moderator = await UserFactory.apply('platformModerator').create()

    const response = await client
      .get('/fr/admin/consents')
      .header('Accept', 'application/json')
      .loginAs(moderator)

    response.assertStatus(403)
  })

  test('exporte la preuve d’une organisation et trace l’export', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.create()
    const other = await OrganizationFactory.create()
    const signer = await createMember(organization)
    await LegalConsentFactory.merge({
      organizationId: organization.id,
      userId: signer.id,
      ipAddress: '198.51.100.4',
    }).create()
    await LegalConsentFactory.merge({ organizationId: other.id, ipAddress: '10.9.9.9' }).create()

    const response = await client
      .get(`/fr/admin/consents/export?organizationId=${organization.id}`)
      .loginAs(admin)

    response.assertStatus(200)
    assert.include(response.header('content-type'), 'text/csv')
    assert.include(response.header('content-disposition'), `consentements-${organization.id}.csv`)
    assert.include(response.text(), '198.51.100.4')
    assert.include(response.text(), signer.email)
    assert.notInclude(response.text(), '10.9.9.9')

    const log = await AdminAuditLog.query().where('action', 'consent.exported').firstOrFail()
    assert.equal(log.targetType, 'organization')
    assert.equal(log.targetId, organization.id)
    assert.equal(log.actorUserId, admin.id)
  })

  test('l’export d’une organisation inconnue donne 404 sans écrire d’audit', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client
      .get('/fr/admin/consents/export?organizationId=999999')
      .header('Accept', 'application/json')
      .loginAs(admin)

    response.assertStatus(404)
    assert.lengthOf(await AdminAuditLog.query().where('action', 'consent.exported'), 0)
  })

  test('l’export neutralise les formules dans les cellules', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.create()
    await LegalConsentFactory.merge({
      organizationId: organization.id,
      ipAddress: '=1+1',
    }).create()

    const response = await client
      .get(`/fr/admin/consents/export?organizationId=${organization.id}`)
      .loginAs(admin)

    assert.include(response.text(), `"'=1+1"`)
  })

  test('refuse l’export sans le droit d’audit', async ({ client }) => {
    const moderator = await UserFactory.apply('platformModerator').create()
    const organization = await OrganizationFactory.create()

    const response = await client
      .get(`/fr/admin/consents/export?organizationId=${organization.id}`)
      .header('Accept', 'application/json')
      .loginAs(moderator)

    response.assertStatus(403)
  })
})
