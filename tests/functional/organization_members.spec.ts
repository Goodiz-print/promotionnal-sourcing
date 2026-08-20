import { test } from '@japa/runner'
import { OrganizationFactory } from '#database/factories/organization_factory'
import Role from '#models/role'
import OrganizationUser from '#models/organization_user'
import OrganizationMemberTransformer from '#transformers/organization_member_transformer'
import OrganizationMembersService from '#services/organization_members_service'
import OrganizationContextService from '#services/organization_context_service'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

test.group('Gestion des membres de l’organisation', (group) => {
  useDatabase(group)

  test("l'écran liste les membres pour un owner", async ({ client, assert }) => {
    const org = await OrganizationFactory.create()
    const owner = await createMember(org, 'owner')
    await createMember(org, 'member', {}, { asCurrent: false })

    const response = await client.get('/fr/organization/members').withInertia().loginAs(owner)

    response.assertStatus(200)
    response.assertInertiaComponent('organization/members')
    assert.lengthOf(response.inertiaProps.members, 2)
    assert.lengthOf(response.inertiaProps.roles, 4)
  })

  test('un membre simple ne peut pas accéder à la liste (403)', async ({ client }) => {
    const org = await OrganizationFactory.create()
    const member = await createMember(org, 'member')

    const response = await client.get('/fr/organization/members').withInertia().loginAs(member)

    response.assertStatus(403)
  })

  test("l'owner change le rôle d'un membre", async ({ client, assert }) => {
    const org = await OrganizationFactory.create()
    const owner = await createMember(org, 'owner')
    const member = await createMember(org, 'member', {}, { asCurrent: false })
    const adminRole = await Role.findByOrFail('slug', 'admin')

    const membership = await OrganizationUser.query()
      .where('userId', member.id)
      .where('organizationId', org.id)
      .firstOrFail()

    const response = await client
      .patch(`/fr/organization/members/${membership.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({ roleId: adminRole.id })

    response.assertStatus(200)
    await membership.refresh()
    assert.equal(membership.roleId, adminRole.id)
  })

  test('impossible de rétrograder le dernier owner', async ({ client, assert }) => {
    const org = await OrganizationFactory.create()
    const owner = await createMember(org, 'owner')
    const adminRole = await Role.findByOrFail('slug', 'admin')

    const membership = await OrganizationUser.query()
      .where('userId', owner.id)
      .where('organizationId', org.id)
      .firstOrFail()

    const response = await client
      .patch(`/fr/organization/members/${membership.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({ roleId: adminRole.id })

    response.assertStatus(200)
    await membership.refresh()
    const ownerRole = await Role.findByOrFail('slug', 'owner')
    assert.equal(membership.roleId, ownerRole.id, 'le rôle owner ne doit pas changer')
  })

  test('un second owner peut être rétrogradé sans erreur', async ({ assert }) => {
    const org = await OrganizationFactory.create()
    const owner1 = await createMember(org, 'owner')
    await createMember(org, 'owner', {}, { asCurrent: false })
    const adminRole = await Role.findByOrFail('slug', 'admin')

    const membership1 = await OrganizationUser.query()
      .where('userId', owner1.id)
      .where('organizationId', org.id)
      .firstOrFail()

    const service = new OrganizationMembersService(new OrganizationContextService())
    await service.changeRole(membership1, adminRole.id)

    await membership1.refresh()
    assert.equal(membership1.roleId, adminRole.id)
  })

  test('un owner retire un membre simple, qui perd son organisation courante', async ({
    client,
    assert,
  }) => {
    const org = await OrganizationFactory.create()
    const owner = await createMember(org, 'owner')
    const member = await createMember(org, 'member')

    const membership = await OrganizationUser.query()
      .where('userId', member.id)
      .where('organizationId', org.id)
      .firstOrFail()

    const response = await client
      .delete(`/fr/organization/members/${membership.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)

    response.assertStatus(200)
    const stillExists = await OrganizationUser.find(membership.id)
    assert.isNull(stillExists)
    await member.refresh()
    assert.isNull(member.currentOrganizationId)
  })

  test('impossible de retirer le dernier owner', async ({ client, assert }) => {
    const org = await OrganizationFactory.create()
    const owner = await createMember(org, 'owner')

    const membership = await OrganizationUser.query()
      .where('userId', owner.id)
      .where('organizationId', org.id)
      .firstOrFail()

    const response = await client
      .delete(`/fr/organization/members/${membership.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)

    response.assertStatus(200)
    const stillExists = await OrganizationUser.find(membership.id)
    assert.isNotNull(stillExists)
  })

  test('le transformer expose la forme OrganizationMemberType', async ({ assert }) => {
    const org = await OrganizationFactory.create()
    const owner = await createMember(org, 'owner', { email: 'owner@example.com' })

    const membership = await OrganizationUser.query()
      .where('userId', owner.id)
      .where('organizationId', org.id)
      .preload('user')
      .preload('role')
      .firstOrFail()

    const dto = new OrganizationMemberTransformer(membership).toObject()

    assert.equal(dto.email, 'owner@example.com')
    assert.equal(dto.role.slug, 'owner')
    assert.isString(dto.joinedAt)
  })
})
