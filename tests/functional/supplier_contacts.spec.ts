import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import type { ApiClient } from '@japa/api-client'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { OrganizationSubscriptionFactory } from '#database/factories/organization_subscription_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import { SupplierContactFactory } from '#database/factories/supplier_contact_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'
import { UserFactory } from '#database/factories/user_factory'
import type Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import SupplierContact from '#models/supplier_contact'
import SupplierProfile from '#models/supplier_profile'
import type User from '#models/user'
import SupplierContactService from '#services/supplier_contact_service'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

/**
 * Équipe commerciale des fournisseurs (#241) : gestion dans l'espace
 * fournisseur et règle d'affichage aux agences (abonnement, pays, repli).
 */

async function supplierOrg(): Promise<Organization> {
  return OrganizationFactory.apply('supplier').create()
}

async function subscribe(org: Organization) {
  await OrganizationSubscriptionFactory.merge({ organizationId: org.id }).create()
}

async function contact(
  org: Organization,
  fields: { name: string; countries: string[]; position?: number }
) {
  return SupplierContactFactory.merge({ position: 0, ...fields, organizationId: org.id }).create()
}

function names(contacts: { name: string }[]): string[] {
  return contacts.map((row) => row.name).sort()
}

test.group('Contacts commerciaux — règle d’affichage', (group) => {
  useDatabase(group)

  const viewer = (country: string | null) => ({ organizationId: 1, country })

  test('un visiteur non connecté ne reçoit aucun contact', async ({ assert }) => {
    const service = await app.container.make(SupplierContactService)
    const org = await supplierOrg()
    await subscribe(org)
    await contact(org, { name: 'Claire', countries: ['FR'] })

    assert.deepEqual(await service.visibleFor(org.id, null), [])
  })

  test("aucun contact d'un fournisseur non abonné, puis abonné, puis expiré", async ({
    assert,
  }) => {
    const service = await app.container.make(SupplierContactService)
    const org = await supplierOrg()
    await contact(org, { name: 'Claire', countries: ['FR'] })

    assert.deepEqual(await service.visibleFor(org.id, viewer('FR')), [])

    const subscription = await OrganizationSubscriptionFactory.merge({
      organizationId: org.id,
    }).create()
    assert.deepEqual(names(await service.visibleFor(org.id, viewer('FR'))), ['Claire'])

    await subscription.merge({ status: 'expired' }).save()
    assert.deepEqual(await service.visibleFor(org.id, viewer('FR')), [])
  })

  test('une agence française ne voit que les contacts couvrant la France ou tous les pays', async ({
    assert,
  }) => {
    const service = await app.container.make(SupplierContactService)
    const org = await supplierOrg()
    await subscribe(org)
    await contact(org, { name: 'Claire', countries: ['FR', 'BE'] })
    await contact(org, { name: 'Ana', countries: ['RO'] })
    await contact(org, { name: 'Export', countries: [] })

    assert.deepEqual(names(await service.visibleFor(org.id, viewer('FR'))), ['Claire', 'Export'])
    // Le pays de l'agence est comparé sans tenir compte de la casse.
    assert.deepEqual(names(await service.visibleFor(org.id, viewer('ro'))), ['Ana', 'Export'])
  })

  test("sans contact pour son pays, l'agence voit toute l'équipe", async ({ assert }) => {
    const service = await app.container.make(SupplierContactService)
    const org = await supplierOrg()
    await subscribe(org)
    await contact(org, { name: 'Ana', countries: ['RO'] })
    await contact(org, { name: 'Hans', countries: ['DE'] })

    assert.deepEqual(names(await service.visibleFor(org.id, viewer('FR'))), ['Ana', 'Hans'])
    assert.deepEqual(names(await service.visibleFor(org.id, viewer(null))), ['Ana', 'Hans'])
  })

  test("avec l'option activée, toutes les agences voient toute l'équipe", async ({ assert }) => {
    const service = await app.container.make(SupplierContactService)
    const org = await supplierOrg()
    await subscribe(org)
    await contact(org, { name: 'Claire', countries: ['FR'] })
    await contact(org, { name: 'Ana', countries: ['RO'] })
    await service.setShowAllContacts(org.id, true)

    assert.deepEqual(names(await service.visibleFor(org.id, viewer('FR'))), ['Ana', 'Claire'])
  })

  test('les contacts sont rendus dans leur ordre d’affichage', async ({ assert }) => {
    const service = await app.container.make(SupplierContactService)
    const org = await supplierOrg()
    await subscribe(org)
    await contact(org, { name: 'Second', countries: [], position: 1 })
    await contact(org, { name: 'Premier', countries: [], position: 0 })

    const visible = await service.visibleFor(org.id, viewer('FR'))
    assert.deepEqual(
      visible.map((row) => row.name),
      ['Premier', 'Second']
    )
  })

  test('plusieurs fournisseurs à la fois : la règle s’applique à chacun', async ({ assert }) => {
    const service = await app.container.make(SupplierContactService)
    const filtered = await supplierOrg()
    await subscribe(filtered)
    await contact(filtered, { name: 'Claire', countries: ['FR'] })
    await contact(filtered, { name: 'Ana', countries: ['RO'] })
    const wholeTeam = await supplierOrg()
    await subscribe(wholeTeam)
    await contact(wholeTeam, { name: 'Hans', countries: ['DE'] })
    await contact(wholeTeam, { name: 'Export', countries: ['IT'] })
    await service.setShowAllContacts(wholeTeam.id, true)
    const free = await supplierOrg()
    await contact(free, { name: 'Gratuit', countries: [] })
    const empty = await supplierOrg()
    await subscribe(empty)

    const visible = await service.visibleForMany(
      [filtered.id, wholeTeam.id, free.id, empty.id, filtered.id],
      viewer('FR')
    )

    assert.sameMembers([...visible.keys()], [filtered.id, wholeTeam.id])
    assert.deepEqual(names(visible.get(filtered.id)!), ['Claire'])
    assert.deepEqual(names(visible.get(wholeTeam.id)!), ['Export', 'Hans'])
  })

  test('seule une agence connectée est un visiteur qui reçoit des contacts', async ({ assert }) => {
    const service = await app.container.make(SupplierContactService)
    const agency = await OrganizationFactory.merge({ country: 'BE' }).create()
    const both = await OrganizationFactory.apply('both').create()
    const competitor = await supplierOrg()
    const archived = await OrganizationFactory.apply('archived').create()

    assert.isNull(await service.viewerFor(null))
    assert.isNull(await service.viewerFor(await UserFactory.create()))
    assert.isNull(await service.viewerFor(await createMember(competitor, 'owner')))
    assert.isNull(await service.viewerFor(await createMember(archived, 'owner')))
    assert.deepEqual(await service.viewerFor(await createMember(agency, 'member')), {
      organizationId: agency.id,
      country: 'BE',
    })
    const bothViewer = await service.viewerFor(await createMember(both, 'owner'))
    assert.equal(bothViewer?.organizationId, both.id)
  })

  test('une agence en cours de validation ne reçoit rien, puis tout une fois validée', async ({
    assert,
  }) => {
    const service = await app.container.make(SupplierContactService)
    const pending = await OrganizationFactory.merge({
      country: 'FR',
      reviewReasons: ['vat_unverified', 'free_email_domain'],
    }).create()
    const user = await createMember(pending, 'owner')

    assert.isNull(await service.viewerFor(user))

    // Décision `approved` : `review_reasons` est vidé.
    await pending.merge({ reviewReasons: [] }).save()
    assert.deepEqual(await service.viewerFor(user), { organizationId: pending.id, country: 'FR' })
  })
})

test.group('Contacts commerciaux — espace fournisseur', (group) => {
  useDatabase(group)

  async function owner(): Promise<{ org: Organization; user: User }> {
    const org = await supplierOrg()
    return { org, user: await createMember(org, 'owner') }
  }

  /** Requêtes Inertia (CSRF, sans suivre la redirection) au nom de `user`. */
  function asUser(client: ApiClient, user: User) {
    const call =
      (method: 'post' | 'patch' | 'delete') =>
      (url: string, payload: Record<string, unknown> = {}) =>
        client[method](url).withInertia().withCsrfToken().redirects(0).loginAs(user).json(payload)
    return { post: call('post'), patch: call('patch'), delete: call('delete') }
  }

  test('le fournisseur gratuit voit son équipe et le rappel abonnement', async ({
    client,
    assert,
  }) => {
    const { org, user } = await owner()
    await contact(org, { name: 'Claire', countries: ['FR'] })

    const response = await client.get('/fr/supplier/contacts').withInertia().loginAs(user)

    response.assertStatus(200)
    response.assertInertiaComponent('supplier/contacts/index')
    assert.isFalse(response.inertiaProps.isSubscribed)
    assert.isFalse(response.inertiaProps.showAllContacts)
    assert.deepEqual(
      response.inertiaProps.contacts.map((row: { name: string }) => row.name),
      ['Claire']
    )
    assert.deepEqual(
      response.inertiaProps.members.map((row: { id: number }) => row.id),
      [user.id]
    )
  })

  test('un simple membre ne gère pas l’équipe', async ({ client }) => {
    const org = await supplierOrg()
    const member = await createMember(org, 'member')

    const response = await client.get('/fr/supplier/contacts').withInertia().loginAs(member)

    response.assertStatus(403)
  })

  test('ajoute un contact avec ses pays, ses langues et un membre du compte', async ({
    client,
    assert,
  }) => {
    const { org, user } = await owner()
    await contact(org, { name: 'Existant', countries: [], position: 0 })

    const response = await asUser(client, user).post('/fr/supplier/contacts', {
      name: 'Claire Martin',
      jobTitle: 'Key account',
      email: 'claire@example.com',
      phone: null,
      languages: ['fr', 'en'],
      countries: ['FR', 'BE'],
      userId: user.id,
    })

    response.assertStatus(302)
    const created = await SupplierContact.query()
      .where('organizationId', org.id)
      .where('name', 'Claire Martin')
      .firstOrFail()
    assert.deepEqual(created.countries, ['FR', 'BE'])
    assert.deepEqual(created.languages, ['fr', 'en'])
    assert.equal(created.userId, user.id)
    assert.equal(created.position, 1)
  })

  test('un contact peut exister sans compte utilisateur', async ({ client, assert }) => {
    const { org, user } = await owner()

    await asUser(client, user)
      .post('/fr/supplier/contacts', {
        name: 'Ana Pop',
        email: 'ana@example.com',
        countries: [],
      })
      .then((response) => response.assertStatus(302))

    const created = await SupplierContact.findByOrFail('organizationId', org.id)
    assert.isNull(created.userId)
    assert.deepEqual(created.countries, [])
  })

  test("refuse de relier un utilisateur qui n'est pas membre du compte", async ({
    client,
    assert,
  }) => {
    const { org, user } = await owner()
    const stranger = await UserFactory.create()

    await asUser(client, user).post('/fr/supplier/contacts', {
      name: 'Intrus',
      email: 'intrus@example.com',
      userId: stranger.id,
    })

    assert.isNull(await SupplierContact.findBy('organizationId', org.id))
  })

  test('refuse un code pays inconnu', async ({ client, assert }) => {
    const { org, user } = await owner()

    await asUser(client, user).post('/fr/supplier/contacts', {
      name: 'Claire',
      email: 'claire@example.com',
      countries: ['XX'],
    })

    assert.isNull(await SupplierContact.findBy('organizationId', org.id))
  })

  test('modifie, déplace et supprime un contact', async ({ client, assert }) => {
    const { org, user } = await owner()
    const first = await contact(org, { name: 'Premier', countries: [], position: 0 })
    const second = await contact(org, { name: 'Second', countries: [], position: 1 })

    await asUser(client, user)
      .patch(`/fr/supplier/contacts/${first.id}`, {
        name: 'Premier modifié',
        email: 'premier@example.com',
        countries: ['de'],
      })
      .then((response) => response.assertStatus(303))
    await first.refresh()
    assert.equal(first.name, 'Premier modifié')
    assert.deepEqual(first.countries, ['DE'])

    await asUser(client, user)
      .post(`/fr/supplier/contacts/${second.id}/move`, {
        direction: 'up',
      })
      .then((response) => response.assertStatus(302))
    await Promise.all([first.refresh(), second.refresh()])
    assert.equal(second.position, 0)
    assert.equal(first.position, 1)

    await asUser(client, user)
      .delete(`/fr/supplier/contacts/${first.id}`)
      .then((response) => response.assertStatus(303))
    assert.isNull(await SupplierContact.find(first.id))
  })

  test("ne touche pas au contact d'un autre fournisseur", async ({ client, assert }) => {
    const { user } = await owner()
    const other = await supplierOrg()
    const foreign = await contact(other, { name: 'Autre', countries: [] })

    const response = await asUser(client, user).delete(`/fr/supplier/contacts/${foreign.id}`)

    response.assertStatus(404)
    assert.isNotNull(await SupplierContact.find(foreign.id))
  })

  test('le départ du membre relié délie le contact sans le supprimer', async ({
    client,
    assert,
  }) => {
    const { org, user } = await owner()
    const seller = await createMember(org, 'member')
    const linked = await SupplierContactFactory.merge({
      organizationId: org.id,
      userId: seller.id,
    }).create()
    const membership = await OrganizationUser.query()
      .where('organizationId', org.id)
      .where('userId', seller.id)
      .firstOrFail()

    await asUser(client, user)
      .delete(`/fr/organization/members/${membership.id}`)
      .then((response) => response.assertStatus(303))

    await linked.refresh()
    assert.isNull(linked.userId)
  })

  test('la base refuse de relier un utilisateur qui n’est pas membre du compte', async ({
    assert,
  }) => {
    const org = await supplierOrg()
    const stranger = await UserFactory.create()

    await assert.rejects(() =>
      SupplierContactFactory.merge({ organizationId: org.id, userId: stranger.id }).create()
    )
  })

  test("enregistre l'option « montrer toute l'équipe »", async ({ client, assert }) => {
    const { org, user } = await owner()

    await asUser(client, user)
      .patch('/fr/supplier/contacts/settings', {
        showAllContacts: true,
      })
      .then((response) => response.assertStatus(303))

    const profile = await SupplierProfile.findByOrFail('organizationId', org.id)
    assert.isTrue(profile.showAllContacts)
  })
})

test.group('Contacts commerciaux — props envoyées à l’agence', (group) => {
  useDatabase(group)

  async function publicSupplier() {
    const org = await supplierOrg()
    const supplier = await SupplierFactory.merge({ organizationId: org.id }).create()
    await contact(org, { name: 'Claire', countries: ['FR'] })
    await contact(org, { name: 'Ana', countries: ['RO'] })
    return { org, supplier }
  }

  test('page fournisseur : un visiteur non connecté ne reçoit aucun contact', async ({
    client,
    assert,
  }) => {
    const { org, supplier } = await publicSupplier()
    await subscribe(org)

    const response = await client.get(`/fr/suppliers/${supplier.slug}`).withInertia()

    response.assertStatus(200)
    assert.deepEqual(response.inertiaProps.contacts, [])
  })

  test('page fournisseur : une agence française reçoit seulement le contact France', async ({
    client,
    assert,
  }) => {
    const { org, supplier } = await publicSupplier()
    await subscribe(org)
    const agency = await OrganizationFactory.merge({ country: 'FR' }).create()
    const buyer = await createMember(agency, 'owner')

    const response = await client.get(`/fr/suppliers/${supplier.slug}`).withInertia().loginAs(buyer)

    assert.deepEqual(
      response.inertiaProps.contacts.map((row: { name: string }) => row.name),
      ['Claire']
    )
    assert.deepEqual(response.inertiaProps.contacts[0].countries, ['FR'])
  })

  test('page fournisseur : un fournisseur concurrent ne reçoit aucun contact', async ({
    client,
    assert,
  }) => {
    const { org, supplier } = await publicSupplier()
    await subscribe(org)
    const competitor = await createMember(await supplierOrg(), 'owner')

    const response = await client
      .get(`/fr/suppliers/${supplier.slug}`)
      .withInertia()
      .loginAs(competitor)

    assert.deepEqual(response.inertiaProps.contacts, [])
  })

  test('page fournisseur et détail de demande : rien pour une agence en cours de validation', async ({
    client,
    assert,
  }) => {
    const { org, supplier } = await publicSupplier()
    await subscribe(org)
    const pending = await OrganizationFactory.merge({
      country: 'FR',
      reviewReasons: ['domain_mismatch'],
    }).create()
    const buyer = await createMember(pending, 'owner')
    const rfq = await RfqFactory.apply('published')
      .merge({ buyerOrganizationId: pending.id })
      .create()
    await RfqSupplierFactory.apply('sent')
      .merge({ rfqId: rfq.id, supplierOrganizationId: org.id })
      .create()

    const page = await client.get(`/fr/suppliers/${supplier.slug}`).withInertia().loginAs(buyer)
    assert.deepEqual(page.inertiaProps.contacts, [])

    const detail = await client.get(`/fr/rfqs/${rfq.id}`).withInertia().loginAs(buyer)
    detail.assertStatus(200)
    assert.deepEqual(detail.inertiaProps.supplierContacts, {})
  })

  test('page fournisseur : rien pour un fournisseur gratuit', async ({ client, assert }) => {
    const { supplier } = await publicSupplier()
    const agency = await OrganizationFactory.merge({ country: 'FR' }).create()
    const buyer = await createMember(agency, 'owner')

    const response = await client.get(`/fr/suppliers/${supplier.slug}`).withInertia().loginAs(buyer)

    assert.deepEqual(response.inertiaProps.contacts, [])
  })

  test('détail d’une demande : contacts des destinataires abonnés, filtrés par pays', async ({
    client,
    assert,
  }) => {
    const { org: subscribed } = await publicSupplier()
    await subscribe(subscribed)
    const free = await supplierOrg()
    await contact(free, { name: 'Gratuit', countries: [] })

    const agency = await OrganizationFactory.merge({ country: 'RO' }).create()
    const buyer = await createMember(agency, 'owner')
    const rfq = await RfqFactory.apply('published')
      .merge({ buyerOrganizationId: agency.id })
      .create()
    await Promise.all(
      [subscribed, free].map((supplier) =>
        RfqSupplierFactory.apply('sent')
          .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id })
          .create()
      )
    )

    const response = await client.get(`/fr/rfqs/${rfq.id}`).withInertia().loginAs(buyer)

    response.assertStatus(200)
    const supplierContacts = response.inertiaProps.supplierContacts
    assert.deepEqual(Object.keys(supplierContacts), [String(subscribed.id)])
    assert.deepEqual(
      supplierContacts[subscribed.id].map((row: { name: string }) => row.name),
      ['Ana']
    )
  })
})
