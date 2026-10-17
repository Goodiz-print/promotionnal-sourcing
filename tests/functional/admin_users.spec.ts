import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

interface ListedUser {
  id: number
  email: string
  organizationsCount: number
  platformRole: string
  emailVerified: boolean
}

test.group('Back-office — utilisateurs', (group) => {
  useDatabase(group)

  test('liste les comptes sans jamais exposer le mot de passe', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.create()
    const member = await createMember(organization, 'member')

    const response = await client.get('/fr/admin/users').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/users/index')
    const users: ListedUser[] = response.inertiaProps.users.data
    assert.equal(users.find((u) => u.id === member.id)?.organizationsCount, 1)
    assert.equal(users.find((u) => u.id === admin.id)?.platformRole, 'admin')
    assert.notProperty(users[0], 'password')
  })

  test('recherche partielle et insensible à la casse sur l’email', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await UserFactory.merge({ email: 'Jane.Doe@acme-test.io' }).create()
    await UserFactory.merge({ email: 'autre@exemple.fr' }).create()

    const response = await client
      .get('/fr/admin/users?search=JANE.doe@ACME')
      .withInertia()
      .loginAs(admin)

    const emails = response.inertiaProps.users.data.map((u: ListedUser) => u.email)
    assert.deepEqual(emails, [target.email])
    assert.equal(response.inertiaProps.filters.search, 'JANE.doe@ACME')
  })

  test('les jokers LIKE saisis sont traités littéralement', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await UserFactory.merge({ email: 'abc@exemple.fr' }).create()

    const response = await client.get('/fr/admin/users?search=%25').withInertia().loginAs(admin)

    assert.lengthOf(response.inertiaProps.users.data, 0)
  })

  test('signale les emails non vérifiés', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const pending = await UserFactory.apply('unverified').create()

    const response = await client
      .get(`/fr/admin/users?search=${encodeURIComponent(pending.email)}`)
      .withInertia()
      .loginAs(admin)

    assert.isFalse(response.inertiaProps.users.data[0].emailVerified)
  })

  test('un utilisateur ordinaire reçoit un 403', async ({ client }) => {
    const user = await createMember(await OrganizationFactory.create(), 'owner')

    const response = await client.get('/fr/admin/users').withInertia().loginAs(user)

    response.assertStatus(403)
  })
})
