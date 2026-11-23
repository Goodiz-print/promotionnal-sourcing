import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import { OrganizationFactory } from '#database/factories/organization_factory'
import Rfq from '#models/rfq'
import RfqItem from '#models/rfq_item'
import RfqSupplier from '#models/rfq_supplier'
import RfqService from '#services/rfq_service'
import RfqRecipientService from '#services/rfq_recipient_service'
import {
  NotASupplierOrganizationException,
  RfqNotClosableException,
  RfqNotEditableException,
  RfqNotFoundException,
  RfqNotPublishableException,
  RfqNotSendableException,
  RfqSupplierNotFoundException,
} from '#exceptions/rfq_errors'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

test.group('RFQ — cycle de vie', (group) => {
  useDatabase(group)

  /**
   * Contexte commun : un acheteur (avec son owner) et deux fournisseurs.
   */
  async function setupActors() {
    const buyer = await OrganizationFactory.create()
    const owner = await createMember(buyer, 'owner')

    const supplierA = await OrganizationFactory.apply('supplier').create()
    const supplierB = await OrganizationFactory.apply('both').create()

    return { buyer, owner, supplierA, supplierB, service: await app.container.make(RfqService) }
  }

  async function draftWithItem(actors: Awaited<ReturnType<typeof setupActors>>): Promise<Rfq> {
    return actors.service.create(actors.buyer, actors.owner, {
      title: 'Tote bags coton bio',
      items: [{ name: 'Tote bag 240g', quantity: 500, unit: 'pièce' }],
    })
  }

  test('crée un brouillon avec ses items', async ({ assert }) => {
    const actors = await setupActors()

    const rfq = await actors.service.create(actors.buyer, actors.owner, {
      title: 'Tote bags coton bio',
      description: 'Sérigraphie 1 couleur',
      deadline: '2026-10-01T00:00:00.000Z',
      budgetMax: 4500,
      items: [
        { name: 'Tote bag 240g', quantity: 500, unit: 'pièce', specs: { couleur: 'écru' } },
        { name: 'Étiquette tissée', quantity: 500 },
      ],
    })

    assert.equal(rfq.status, 'draft')
    assert.equal(rfq.buyerOrganizationId, actors.buyer.id)
    assert.equal(rfq.createdByUserId, actors.owner.id)
    assert.isNull(rfq.publishedAt)
    assert.lengthOf(rfq.items, 2)
    // `budget_max` est une colonne decimal : relue en chaîne à 2 décimales.
    const persisted = await Rfq.findOrFail(rfq.id)
    assert.equal(persisted.budgetMax, '4500.00')

    // `specs` (jsonb) doit revenir en objet quel que soit le driver.
    const item = await RfqItem.findByOrFail('name', 'Tote bag 240g')
    assert.deepEqual(item.specs, { couleur: 'écru' })
    const bare = await RfqItem.findByOrFail('name', 'Étiquette tissée')
    assert.isNull(bare.specs)
  })

  test("remplace les items d'un brouillon", async ({ assert }) => {
    const actors = await setupActors()
    const rfq = await draftWithItem(actors)

    const items = await actors.service.replaceItems(rfq, [
      { name: 'Gourde inox 500ml', quantity: 300 },
    ])

    assert.lengthOf(items, 1)
    const persisted = await RfqItem.query().where('rfqId', rfq.id)
    assert.lengthOf(persisted, 1)
    assert.equal(persisted[0].name, 'Gourde inox 500ml')
  })

  test('refuse de modifier une demande publiée', async ({ assert }) => {
    const actors = await setupActors()
    const rfq = await draftWithItem(actors)
    await actors.service.publish(rfq)

    await assert.rejects(
      () => actors.service.update(rfq, { title: 'Autre titre' }),
      RfqNotEditableException.message
    )
    await assert.rejects(
      () => actors.service.replaceItems(rfq, []),
      RfqNotEditableException.message
    )
  })

  test('refuse de publier une demande sans item', async ({ assert }) => {
    const actors = await setupActors()
    const rfq = await actors.service.create(actors.buyer, actors.owner, { title: 'Vide' })

    await assert.rejects(() => actors.service.publish(rfq), RfqNotPublishableException.message)
    const untouched = await Rfq.findOrFail(rfq.id)
    assert.equal(untouched.status, 'draft')
  })

  test('publie une demande complète', async ({ assert }) => {
    const actors = await setupActors()
    const rfq = await draftWithItem(actors)

    await actors.service.publish(rfq)

    const reloaded = await Rfq.findOrFail(rfq.id)
    assert.equal(reloaded.status, 'published')
    assert.isNotNull(reloaded.publishedAt)
    await assert.rejects(() => actors.service.publish(reloaded), RfqNotPublishableException.message)
  })

  test('ajoute des destinataires fournisseurs, sans doublon', async ({ assert }) => {
    const actors = await setupActors()
    const rfq = await draftWithItem(actors)

    const created = await actors.service.addSuppliers(rfq, [
      actors.supplierA.id,
      actors.supplierB.id,
      actors.supplierA.id,
    ])
    assert.lengthOf(created, 2)
    assert.deepEqual(
      created.map((row) => row.status),
      ['pending', 'pending']
    )

    // Second appel : rien de neuf, aucune ligne dupliquée.
    assert.lengthOf(await actors.service.addSuppliers(rfq, [actors.supplierA.id]), 0)
    assert.lengthOf(await RfqSupplier.query().where('rfqId', rfq.id), 2)
  })

  test('refuse une organisation acheteuse ou archivée comme destinataire', async ({ assert }) => {
    const actors = await setupActors()
    const rfq = await draftWithItem(actors)
    const otherBuyer = await OrganizationFactory.create()
    const archived = await OrganizationFactory.apply('supplier').create()
    await archived.merge({ archivedAt: DateTime.now() }).save()

    await assert.rejects(
      () => actors.service.addSuppliers(rfq, [otherBuyer.id]),
      NotASupplierOrganizationException.message
    )
    await assert.rejects(
      () => actors.service.addSuppliers(rfq, [archived.id]),
      NotASupplierOrganizationException.message
    )
    assert.lengthOf(await RfqSupplier.query().where('rfqId', rfq.id), 0)
  })

  test('retire un destinataire tant qu’il n’est pas notifié', async ({ assert }) => {
    const actors = await setupActors()
    const rfq = await draftWithItem(actors)
    const [target] = await actors.service.addSuppliers(rfq, [actors.supplierA.id])

    await actors.service.removeSupplier(rfq, target.id)
    assert.lengthOf(await RfqSupplier.query().where('rfqId', rfq.id), 0)

    await assert.rejects(
      () => actors.service.removeSupplier(rfq, target.id),
      RfqSupplierNotFoundException.message
    )
  })

  test('refuse de retirer un destinataire déjà notifié', async ({ assert }) => {
    const actors = await setupActors()
    const rfq = await draftWithItem(actors)
    const [target] = await actors.service.addSuppliers(rfq, [actors.supplierA.id])
    await actors.service.publish(rfq)
    await actors.service.send(rfq)

    await assert.rejects(
      () => actors.service.removeSupplier(rfq, target.id),
      RfqNotEditableException.message
    )
  })

  test('envoie la demande aux destinataires en attente, une seule fois', async ({ assert }) => {
    const actors = await setupActors()
    const rfq = await draftWithItem(actors)
    await actors.service.addSuppliers(rfq, [actors.supplierA.id])
    await actors.service.publish(rfq)

    const sent = await actors.service.send(rfq)
    assert.lengthOf(sent, 1)
    assert.equal(sent[0].status, 'sent')
    assert.isNotNull(sent[0].sentAt)
    // La relation est préchargée : l'appelant compose le mail sans requête.
    assert.equal(sent[0].supplierOrganization.id, actors.supplierA.id)

    await assert.rejects(() => actors.service.send(rfq), RfqNotSendableException.message)
  })

  test('élargit une demande publiée sans renotifier les fournisseurs déjà servis', async ({
    assert,
  }) => {
    const actors = await setupActors()
    const rfq = await draftWithItem(actors)
    await actors.service.addSuppliers(rfq, [actors.supplierA.id])
    await actors.service.publish(rfq)
    const firstBatch = await actors.service.send(rfq)

    await actors.service.addSuppliers(rfq, [actors.supplierB.id])
    const secondBatch = await actors.service.send(rfq)

    assert.lengthOf(secondBatch, 1)
    assert.equal(secondBatch[0].supplierOrganizationId, actors.supplierB.id)
    // Le premier destinataire garde son horodatage d'envoi initial.
    const first = await RfqSupplier.findOrFail(firstBatch[0].id)
    assert.equal(first.sentAt?.toMillis(), firstBatch[0].sentAt?.toMillis())
  })

  test("refuse d'envoyer une demande non publiée", async ({ assert }) => {
    const actors = await setupActors()
    const rfq = await draftWithItem(actors)
    await actors.service.addSuppliers(rfq, [actors.supplierA.id])

    await assert.rejects(() => actors.service.send(rfq), RfqNotSendableException.message)
  })

  test('clôture une demande publiée, jamais un brouillon', async ({ assert }) => {
    const actors = await setupActors()
    const rfq = await draftWithItem(actors)

    await assert.rejects(() => actors.service.close(rfq), RfqNotClosableException.message)

    await actors.service.publish(rfq)
    await actors.service.close(rfq)

    const reloaded = await Rfq.findOrFail(rfq.id)
    assert.equal(reloaded.status, 'closed')
    assert.isNotNull(reloaded.closedAt)
    await assert.rejects(() => actors.service.close(reloaded), RfqNotClosableException.message)
    await assert.rejects(
      () => actors.service.addSuppliers(reloaded, [actors.supplierB.id]),
      RfqNotEditableException.message
    )
  })
})

test.group('RFQ — côté fournisseur', (group) => {
  useDatabase(group)

  async function sentRfq() {
    const buyer = await OrganizationFactory.create()
    const owner = await createMember(buyer, 'owner')
    const supplier = await OrganizationFactory.apply('supplier').create()
    const service = await app.container.make(RfqService)

    const rfq = await service.create(buyer, owner, {
      title: 'Tote bags coton bio',
      items: [{ name: 'Tote bag 240g', quantity: 500 }],
    })
    await service.addSuppliers(rfq, [supplier.id])
    await service.publish(rfq)

    return { buyer, owner, supplier, service, rfq }
  }

  test("n'expose pas une demande dont l'envoi n'est pas fait", async ({ assert }) => {
    const { service, supplier, rfq } = await sentRfq()

    assert.lengthOf(await service.listForSupplier(supplier.id), 0)
    await assert.rejects(
      () => service.findForSupplier(rfq.id, supplier.id),
      RfqNotFoundException.message
    )

    await service.send(rfq)
    assert.lengthOf(await service.listForSupplier(supplier.id), 1)
  })

  test('marque la demande comme consultée, sans régression de statut', async ({ assert }) => {
    const { service, supplier, rfq } = await sentRfq()
    const recipients = await app.container.make(RfqRecipientService)
    await service.send(rfq)

    const viewed = await recipients.markViewed(rfq, supplier.id)
    assert.equal(viewed.status, 'viewed')
    // Idempotent : rouvrir l'écran ne change plus rien.
    const reviewed = await recipients.markViewed(rfq, supplier.id)
    assert.equal(reviewed.status, 'viewed')

    await recipients.markResponded(rfq, supplier.id)
    const afterAnswer = await recipients.markViewed(rfq, supplier.id)
    assert.equal(afterAnswer.status, 'responded')
  })

  test('refuse une réponse avant réception ou après décision', async ({ assert }) => {
    const { service, supplier, rfq } = await sentRfq()
    const recipients = await app.container.make(RfqRecipientService)

    await assert.rejects(
      () => recipients.markResponded(rfq, supplier.id),
      RfqNotEditableException.message
    )

    await service.send(rfq)
    await recipients.decline(rfq, supplier.id)
    await assert.rejects(
      () => recipients.markResponded(rfq, supplier.id),
      RfqNotEditableException.message
    )
  })

  test('refuse toute transition pour une organisation non destinataire', async ({ assert }) => {
    const { rfq } = await sentRfq()
    const recipients = await app.container.make(RfqRecipientService)
    const outsider = await OrganizationFactory.apply('supplier').create()

    await assert.rejects(
      () => recipients.markViewed(rfq, outsider.id),
      RfqSupplierNotFoundException.message
    )
  })
})

test.group('RFQ — lecture acheteur', (group) => {
  useDatabase(group)

  test('cloisonne les demandes par organisation acheteuse', async ({ assert }) => {
    const service = await app.container.make(RfqService)
    const acme = await OrganizationFactory.create()
    const beta = await OrganizationFactory.create()
    const owner = await createMember(acme, 'owner')

    const rfq = await service.create(acme, owner, {
      title: 'Tote bags',
      items: [{ name: 'Tote bag', quantity: 100 }],
    })

    assert.lengthOf(await service.listForBuyer(acme.id), 1)
    assert.lengthOf(await service.listForBuyer(beta.id), 0)
    const found = await service.findForBuyer(rfq.id, acme.id)
    assert.equal(found.id, rfq.id)
    await assert.rejects(() => service.findForBuyer(rfq.id, beta.id), RfqNotFoundException.message)
  })
})
