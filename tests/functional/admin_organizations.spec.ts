import { test } from '@japa/runner'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import { createMember, createOrganizationWithOwner } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

interface ListedOrganization {
  id: number
  slug: string
  membersCount: number
}

test.group('Back-office — organisations', (group) => {
  useDatabase(group)

  test('liste par défaut les organisations actives avec leur nombre de membres', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await createOrganizationWithOwner()
    await createMember(organization, 'member')
    const archived = await OrganizationFactory.apply('archived').create()

    const response = await client.get('/fr/admin/organizations').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/organizations/index')
    const listed: ListedOrganization[] = response.inertiaProps.organizationList.data
    assert.equal(listed.find((o) => o.id === organization.id)?.membersCount, 2)
    assert.isUndefined(listed.find((o) => o.id === archived.id))
    assert.equal(response.inertiaProps.filters.status, 'active')
  })

  test('filtre par statut d’archivage', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const active = await OrganizationFactory.create()
    const archived = await OrganizationFactory.apply('archived').create()

    const onlyArchived = await client
      .get('/fr/admin/organizations?status=archived')
      .withInertia()
      .loginAs(admin)
    const all = await client.get('/fr/admin/organizations?status=all').withInertia().loginAs(admin)

    const archivedIds = onlyArchived.inertiaProps.organizationList.data.map(
      (o: { id: number }) => o.id
    )
    const allIds = all.inertiaProps.organizationList.data.map((o: { id: number }) => o.id)
    assert.deepEqual(archivedIds, [archived.id])
    assert.includeMembers(allIds, [active.id, archived.id])
  })

  test('filtre par type d’organisation', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const buyer = await OrganizationFactory.create()
    const supplier = await OrganizationFactory.apply('supplier').create()

    const response = await client
      .get('/fr/admin/organizations?type=supplier')
      .withInertia()
      .loginAs(admin)

    const ids = response.inertiaProps.organizationList.data.map((o: { id: number }) => o.id)
    assert.include(ids, supplier.id)
    assert.notInclude(ids, buyer.id)
    assert.equal(response.inertiaProps.filters.type, 'supplier')
  })

  test('une valeur de filtre inconnue est ignorée', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client
      .get('/fr/admin/organizations?type=nope&status=nope')
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    assert.isNull(response.inertiaProps.filters.type)
    assert.equal(response.inertiaProps.filters.status, 'active')
  })

  test('la fiche d’une organisation liste ses membres et leur rôle', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization, owner } = await createOrganizationWithOwner()
    const member = await createMember(organization, 'member')

    const response = await client
      .get(`/fr/admin/organizations/${organization.id}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/organizations/show')
    const detail = response.inertiaProps.organization
    assert.equal(detail.id, organization.id)
    assert.equal(detail.membersCount, 2)
    assert.deepEqual(
      detail.members.map((m: { email: string; roleSlug: string }) => [m.email, m.roleSlug]).sort(),
      [
        [owner.email, 'owner'],
        [member.email, 'member'],
      ].sort()
    )
  })

  test('la fiche d’une organisation archivée reste consultable', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const archived = await OrganizationFactory.apply('archived').create()

    const response = await client
      .get(`/fr/admin/organizations/${archived.id}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    assert.isNotNull(response.inertiaProps.organization.archivedAt)
  })

  test('une organisation inconnue renvoie 404', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client.get('/fr/admin/organizations/999999').withInertia().loginAs(admin)

    response.assertStatus(404)
  })

  test('un utilisateur ordinaire ne voit pas la fiche (403)', async ({ client }) => {
    const { organization, owner } = await createOrganizationWithOwner()

    const response = await client
      .get(`/fr/admin/organizations/${organization.id}`)
      .withInertia()
      .loginAs(owner)

    response.assertStatus(403)
  })
})
