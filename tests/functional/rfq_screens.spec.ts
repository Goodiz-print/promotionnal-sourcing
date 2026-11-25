import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqItemFactory } from '#database/factories/rfq_item_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import RfqReceivedNotification from '#mails/rfq_received_notification'
import Rfq from '#models/rfq'
import RfqItem from '#models/rfq_item'
import RfqSupplier from '#models/rfq_supplier'
import { createMember, subscribeOrganization } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type Organization from '#models/organization'
import type User from '#models/user'
import type { RfqReceivedMailData } from '#shared/types/mail'

/**
 * Écrans acheteur des demandes de devis : rendu Inertia, autorisations et
 * transitions déclenchées depuis l'UI. Les règles elles-mêmes sont couvertes
 * par `rfqs.spec.ts` (service) — ici on vérifie le câblage HTTP.
 */
async function buyerWithOwner(): Promise<{ org: Organization; owner: User }> {
  const org = await OrganizationFactory.create()
  const owner = await createMember(org, 'owner')
  return { org, owner }
}

function itemPayload(overrides: Record<string, unknown> = {}) {
  return { name: 'Tote bag 240g', quantity: 500, unit: 'pièce', ...overrides }
}

test.group('Écrans RFQ — acheteur', (group) => {
  useDatabase(group)

  test('la liste affiche les demandes de l’organisation courante', async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()
    const other = await OrganizationFactory.create()
    await RfqFactory.merge({
      buyerOrganizationId: org.id,
      title: 'Tote bags',
      status: 'draft',
    }).create()
    await RfqFactory.merge({
      buyerOrganizationId: other.id,
      title: 'Chez le voisin',
      status: 'draft',
    }).create()

    const response = await client.get('/fr/rfqs').withInertia().loginAs(owner)

    response.assertStatus(200)
    response.assertInertiaComponent('rfqs/index')
    // Regroupée par lot de panier (#228) : une demande seule forme un groupe.
    const [single] = response.inertiaProps.groups
    assert.lengthOf(response.inertiaProps.groups, 1)
    assert.equal(single.rfqs[0].title, 'Tote bags')
    assert.isTrue(response.inertiaProps.canManageRfq)
  })

  test('le formulaire de création propose les fournisseurs éligibles', async ({
    client,
    assert,
  }) => {
    const { owner } = await buyerWithOwner()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const archived = await OrganizationFactory.apply('supplier').apply('archived').create()
    await OrganizationFactory.create()

    const response = await client.get('/fr/rfqs/new').withInertia().loginAs(owner)

    response.assertStatus(200)
    response.assertInertiaComponent('rfqs/create')
    const options = response.inertiaProps.supplierOptions as Array<{ id: number }>
    assert.deepEqual(
      options.map((option) => option.id),
      [supplier.id]
    )
    assert.notInclude(
      options.map((option) => option.id),
      archived.id
    )
  })

  test('la création enregistre le brouillon, ses lignes et ses destinataires', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await buyerWithOwner()
    const supplier = await OrganizationFactory.apply('supplier').create()

    const response = await client
      .post('/fr/rfqs')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({
        title: 'Tote bags coton bio',
        description: 'Sérigraphie 1 couleur',
        budgetMax: 4500,
        items: [itemPayload(), itemPayload({ name: 'Étiquette tissée', quantity: 500 })],
        supplierOrganizationIds: [supplier.id],
      })

    response.assertStatus(200)
    const rfq = await Rfq.findByOrFail('title', 'Tote bags coton bio')
    assert.equal(rfq.buyerOrganizationId, org.id)
    assert.equal(rfq.status, 'draft')
    assert.lengthOf(await RfqItem.query().where('rfqId', rfq.id), 2)

    const [target] = await RfqSupplier.query().where('rfqId', rfq.id)
    assert.equal(target.supplierOrganizationId, supplier.id)
    assert.equal(target.status, 'pending')
  })

  test('la création ignore un lot de panier envoyé par le client (#229)', async ({
    client,
    assert,
  }) => {
    const { owner } = await buyerWithOwner()

    const response = await client
      .post('/fr/rfqs')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({
        title: 'Lot forgé',
        items: [itemPayload()],
        batchId: '3f2b8c1e-4a5d-4e6f-9a7b-8c9d0e1f2a3b',
      })

    response.assertStatus(200)
    const rfq = await Rfq.findByOrFail('title', 'Lot forgé')
    assert.isNull(rfq.batchId)
  })

  test('la création refuse une demande sans ligne', async ({ client, assert }) => {
    const { owner } = await buyerWithOwner()

    // Requête HTML : VineJS renvoie l'utilisateur au formulaire avec ses
    // erreurs en session (302 suivi par le client), il n'y a pas de 422 ici.
    const response = await client
      .post('/fr/rfqs')
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(owner)
      .json({ title: 'Besoin vide', items: [] })

    response.assertStatus(302)
    assert.lengthOf(await Rfq.all(), 0)
  })

  test('le détail expose le besoin et les destinataires', async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const rfq = await RfqFactory.merge({
      buyerOrganizationId: org.id,
      createdByUserId: owner.id,
      title: 'Tote bags',
      status: 'draft',
    }).create()
    await RfqItemFactory.merge({ rfqId: rfq.id, name: 'Tote bag', quantity: 100 }).create()
    await RfqSupplierFactory.merge({
      rfqId: rfq.id,
      supplierOrganizationId: supplier.id,
      status: 'pending',
    }).create()

    const response = await client.get(`/fr/rfqs/${rfq.id}`).withInertia().loginAs(owner)

    response.assertStatus(200)
    response.assertInertiaComponent('rfqs/show')
    assert.lengthOf(response.inertiaProps.rfq.items, 1)
    assert.lengthOf(response.inertiaProps.rfq.suppliers, 1)
    assert.equal(response.inertiaProps.rfq.suppliers[0].name, supplier.name)
    // Déjà destinataire : l'écran n'a pas à le reproposer, mais la prop liste
    // toutes les options — c'est la page qui filtre.
    assert.isNotEmpty(response.inertiaProps.supplierOptions)
  })

  test('une demande d’une autre organisation est un 404', async ({ client }) => {
    const { owner } = await buyerWithOwner()
    const other = await OrganizationFactory.create()
    const rfq = await RfqFactory.merge({
      buyerOrganizationId: other.id,
      title: 'Chez le voisin',
      status: 'draft',
    }).create()

    const response = await client.get(`/fr/rfqs/${rfq.id}`).withInertia().loginAs(owner)

    response.assertStatus(404)
  })

  test('publier puis envoyer bascule les destinataires en `sent`', async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const rfq = await RfqFactory.merge({
      buyerOrganizationId: org.id,
      title: 'Tote bags',
      status: 'draft',
    }).create()
    await RfqItemFactory.merge({ rfqId: rfq.id, name: 'Tote bag', quantity: 100 }).create()
    await RfqSupplierFactory.merge({
      rfqId: rfq.id,
      supplierOrganizationId: supplier.id,
      status: 'pending',
    }).create()

    await client.post(`/fr/rfqs/${rfq.id}/publish`).withInertia().withCsrfToken().loginAs(owner)
    await rfq.refresh()
    assert.equal(rfq.status, 'published')

    // `send` met un mail en queue (`QUEUE_DRIVER=sync` : il partirait pour de
    // vrai vers SMTP) — ce test ne s'intéresse qu'à la bascule de statut.
    mail.fake()
    try {
      await client.post(`/fr/rfqs/${rfq.id}/send`).withInertia().withCsrfToken().loginAs(owner)
    } finally {
      mail.restore()
    }
    const target = await RfqSupplier.findByOrFail('rfqId', rfq.id)
    assert.equal(target.status, 'sent')
    assert.isNotNull(target.sentAt)
  })

  test('publier une demande sans ligne échoue avec un message, sans changer d’état', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await buyerWithOwner()
    const rfq = await RfqFactory.merge({
      buyerOrganizationId: org.id,
      title: 'Besoin vide',
      status: 'draft',
    }).create()

    const response = await client
      .post(`/fr/rfqs/${rfq.id}/publish`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)

    response.assertStatus(200)
    await rfq.refresh()
    assert.equal(rfq.status, 'draft')
  })

  test('un membre simple publie, mais ne clôture pas (#216)', async ({ client, assert }) => {
    const org = await OrganizationFactory.create()
    const member = await createMember(org, 'member')
    const rfq = await RfqFactory.merge({
      buyerOrganizationId: org.id,
      title: 'Tote bags',
      status: 'draft',
    }).create()
    await RfqItemFactory.merge({ rfqId: rfq.id, name: 'Tote bag', quantity: 100 }).create()

    const list = await client.get('/fr/rfqs').withInertia().loginAs(member)
    list.assertStatus(200)
    assert.isTrue(list.inertiaProps.canSendRfq)
    assert.isFalse(list.inertiaProps.canManageRfq)

    const post = (action: string) =>
      client
        .post(`/fr/rfqs/${rfq.id}/${action}`)
        .withInertia()
        .withCsrfToken()
        .redirects(0)
        .loginAs(member)

    const publish = await post('publish')
    publish.assertStatus(302)
    await rfq.refresh()
    assert.equal(rfq.status, 'published')

    // Clôturer reste une décision de responsable : Bouncer renvoie l'utilisateur
    // d'où il vient avec un message plutôt qu'une page 403.
    const close = await post('close')
    close.assertStatus(302)
    await rfq.refresh()
    assert.equal(rfq.status, 'published')
  })

  test('une organisation fournisseuse n’accède pas aux écrans acheteur (403)', async ({
    client,
  }) => {
    const org = await OrganizationFactory.apply('supplier').create()
    const owner = await createMember(org, 'owner')

    const response = await client.get('/fr/rfqs').withInertia().loginAs(owner)

    response.assertStatus(403)
  })

  test('les destinataires s’ajoutent et se retirent tant qu’ils ne sont pas notifiés', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await buyerWithOwner()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const rfq = await RfqFactory.merge({
      buyerOrganizationId: org.id,
      title: 'Tote bags',
      status: 'draft',
    }).create()

    await client
      .post(`/fr/rfqs/${rfq.id}/suppliers`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({ supplierOrganizationIds: [supplier.id] })

    const target = await RfqSupplier.findByOrFail('rfqId', rfq.id)
    assert.equal(target.supplierOrganizationId, supplier.id)

    await client
      .delete(`/fr/rfqs/${rfq.id}/suppliers/${target.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)

    assert.lengthOf(await RfqSupplier.query().where('rfqId', rfq.id), 0)
  })

  test('l’envoi met en queue un mail par destinataire', async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()
    const supplier = await OrganizationFactory.apply('supplier')
      .merge({ email: 'contact@fournisseur.test' })
      .create()
    // Abonné : le mail nomme l'agence (#220).
    await subscribeOrganization(supplier)
    const rfq = await RfqFactory.merge({
      buyerOrganizationId: org.id,
      title: 'Tote bags',
      status: 'draft',
    }).create()
    await RfqItemFactory.merge({ rfqId: rfq.id, name: 'Tote bag', quantity: 100 }).create()
    await RfqSupplierFactory.merge({
      rfqId: rfq.id,
      supplierOrganizationId: supplier.id,
      status: 'pending',
    }).create()
    await client.post(`/fr/rfqs/${rfq.id}/publish`).withInertia().withCsrfToken().loginAs(owner)

    // `QUEUE_DRIVER=sync` en test : le job s'exécute dans le process, le mail
    // est donc réellement envoyé (cf. `docs/mail.md`).
    const { mails } = mail.fake()
    try {
      await client.post(`/fr/rfqs/${rfq.id}/send`).withInertia().withCsrfToken().loginAs(owner)

      mails.assertSentCount(RfqReceivedNotification, 1)
      mails.assertSent(RfqReceivedNotification, (sent) => {
        const fields = sent as unknown as { email: string; data: RfqReceivedMailData }
        return (
          fields.email === 'contact@fournisseur.test' &&
          fields.data.buyerName === org.name &&
          fields.data.rfqPath === `/fr/supplier/rfqs/${rfq.id}`
        )
      })
    } finally {
      mail.restore()
    }

    // Second envoi : plus aucun destinataire en attente, donc aucun rappel.
    const { mails: second } = mail.fake()
    try {
      await client.post(`/fr/rfqs/${rfq.id}/send`).withInertia().withCsrfToken().loginAs(owner)
      second.assertNoneSent()
    } finally {
      mail.restore()
    }
    const recipient = await RfqSupplier.findByOrFail('rfqId', rfq.id)
    assert.equal(recipient.status, 'sent')
  })

  test('sans adresse de contact, le mail part aux membres habilités à répondre', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await buyerWithOwner()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const supplierManager = await createMember(supplier, 'manager', {
      email: 'manager@fournisseur.test',
    })
    await createMember(supplier, 'member', { email: 'membre@fournisseur.test' })
    const rfq = await RfqFactory.merge({
      buyerOrganizationId: org.id,
      title: 'Tote bags',
      status: 'draft',
    }).create()
    await RfqItemFactory.merge({ rfqId: rfq.id, name: 'Tote bag', quantity: 100 }).create()
    await RfqSupplierFactory.merge({
      rfqId: rfq.id,
      supplierOrganizationId: supplier.id,
      status: 'pending',
    }).create()
    await client.post(`/fr/rfqs/${rfq.id}/publish`).withInertia().withCsrfToken().loginAs(owner)

    const { mails } = mail.fake()
    try {
      await client.post(`/fr/rfqs/${rfq.id}/send`).withInertia().withCsrfToken().loginAs(owner)

      // Un `member` n'a pas accès à l'écran de réponse : le prévenir serait
      // une impasse (cf. `RFQ_RESPONDER_ROLES`).
      mails.assertSentCount(RfqReceivedNotification, 1)
      mails.assertSent(
        RfqReceivedNotification,
        (sent) => (sent as unknown as { email: string }).email === supplierManager.email
      )
    } finally {
      mail.restore()
    }
    assert.equal(supplierManager.email, 'manager@fournisseur.test')
  })

  test('la mise à jour remplace les lignes du brouillon', async ({ client, assert }) => {
    const { org, owner } = await buyerWithOwner()
    const rfq = await RfqFactory.merge({
      buyerOrganizationId: org.id,
      title: 'Tote bags',
      status: 'draft',
    }).create()
    await RfqItemFactory.merge({ rfqId: rfq.id, name: 'Ancienne ligne', quantity: 10 }).create()

    await client
      .patch(`/fr/rfqs/${rfq.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({ title: 'Tote bags révisés', items: [itemPayload({ name: 'Gourde inox' })] })

    await rfq.refresh()
    assert.equal(rfq.title, 'Tote bags révisés')
    const items = await RfqItem.query().where('rfqId', rfq.id)
    assert.lengthOf(items, 1)
    assert.equal(items[0].name, 'Gourde inox')
  })
})
