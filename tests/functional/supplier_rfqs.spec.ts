import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqItemFactory } from '#database/factories/rfq_item_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import type Rfq from '#models/rfq'
import RfqSupplier from '#models/rfq_supplier'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type Organization from '#models/organization'
import type { RfqSupplierStatus } from '#shared/types/rfq'

/**
 * Écrans « demandes reçues », côté fournisseur : cloisonnement, accusé de
 * lecture à l'ouverture, refus. Les règles de transition elles-mêmes sont
 * couvertes par `rfqs.spec.ts` (service).
 */
async function publishedRfq(
  buyer: Organization,
  supplier: Organization,
  status: RfqSupplierStatus = 'sent'
): Promise<Rfq> {
  const rfq = await RfqFactory.merge({
    buyerOrganizationId: buyer.id,
    title: 'Tote bags coton bio',
    description: 'Sérigraphie 1 couleur',
    status: 'published',
    publishedAt: DateTime.now(),
  }).create()
  await RfqItemFactory.merge({
    rfqId: rfq.id,
    name: 'Tote bag 240g',
    quantity: 500,
    unit: 'pièce',
  }).create()
  await RfqSupplierFactory.merge({
    rfqId: rfq.id,
    supplierOrganizationId: supplier.id,
    status,
    sentAt: status === 'pending' ? null : DateTime.now(),
  }).create()
  return rfq
}

test.group('Écrans RFQ — fournisseur', (group) => {
  useDatabase(group)

  test('la liste n’affiche que les demandes reçues par l’organisation', async ({
    client,
    assert,
  }) => {
    const supplier = await OrganizationFactory.apply('supplier').create()
    const owner = await createMember(supplier, 'owner')
    const buyer = await OrganizationFactory.create()
    const other = await OrganizationFactory.apply('supplier').create()

    await publishedRfq(buyer, supplier)
    await publishedRfq(buyer, other)

    const response = await client.get('/fr/supplier/rfqs').withInertia().loginAs(owner)

    response.assertStatus(200)
    response.assertInertiaComponent('supplier/rfqs/index')
    assert.lengthOf(response.inertiaProps.rfqs, 1)
    assert.equal(response.inertiaProps.rfqs[0].buyerName, buyer.name)
    assert.equal(response.inertiaProps.rfqs[0].myStatus, 'sent')
  })

  test('une demande préparée mais non envoyée n’existe pas pour le fournisseur', async ({
    client,
    assert,
  }) => {
    const supplier = await OrganizationFactory.apply('supplier').create()
    const owner = await createMember(supplier, 'owner')
    const buyer = await OrganizationFactory.create()
    const rfq = await publishedRfq(buyer, supplier, 'pending')

    const list = await client.get('/fr/supplier/rfqs').withInertia().loginAs(owner)
    assert.lengthOf(list.inertiaProps.rfqs, 0)

    const detail = await client.get(`/fr/supplier/rfqs/${rfq.id}`).withInertia().loginAs(owner)
    detail.assertStatus(404)
  })

  test('ouvrir le détail vaut accusé de lecture', async ({ client, assert }) => {
    const supplier = await OrganizationFactory.apply('supplier').create()
    const owner = await createMember(supplier, 'owner')
    const buyer = await OrganizationFactory.create()
    const rfq = await publishedRfq(buyer, supplier)

    const response = await client.get(`/fr/supplier/rfqs/${rfq.id}`).withInertia().loginAs(owner)

    response.assertStatus(200)
    response.assertInertiaComponent('supplier/rfqs/show')
    // Le statut renvoyé à l'écran reflète déjà la bascule, pas l'état d'avant.
    assert.equal(response.inertiaProps.rfq.myStatus, 'viewed')
    assert.lengthOf(response.inertiaProps.rfq.items, 1)

    const recipient = await RfqSupplier.findByOrFail('rfqId', rfq.id)
    assert.equal(recipient.status, 'viewed')
  })

  test('le budget de l’acheteur n’est jamais exposé au fournisseur', async ({ client, assert }) => {
    const supplier = await OrganizationFactory.apply('supplier').create()
    const owner = await createMember(supplier, 'owner')
    const buyer = await OrganizationFactory.create()
    const rfq = await publishedRfq(buyer, supplier)
    await rfq.merge({ budgetMax: '4500' }).save()

    const response = await client.get(`/fr/supplier/rfqs/${rfq.id}`).withInertia().loginAs(owner)

    assert.notProperty(response.inertiaProps.rfq, 'budgetMax')
    assert.notProperty(response.inertiaProps.rfq, 'suppliers')
  })

  test('rouvrir une demande déjà déclinée ne la fait pas régresser', async ({ client, assert }) => {
    const supplier = await OrganizationFactory.apply('supplier').create()
    const owner = await createMember(supplier, 'owner')
    const buyer = await OrganizationFactory.create()
    const rfq = await publishedRfq(buyer, supplier, 'declined')

    const response = await client.get(`/fr/supplier/rfqs/${rfq.id}`).withInertia().loginAs(owner)

    assert.equal(response.inertiaProps.rfq.myStatus, 'declined')
  })

  test('décliner une demande la marque comme refusée', async ({ client, assert }) => {
    const supplier = await OrganizationFactory.apply('supplier').create()
    const owner = await createMember(supplier, 'owner')
    const buyer = await OrganizationFactory.create()
    const rfq = await publishedRfq(buyer, supplier)

    await client
      .post(`/fr/supplier/rfqs/${rfq.id}/decline`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)

    const recipient = await RfqSupplier.findByOrFail('rfqId', rfq.id)
    assert.equal(recipient.status, 'declined')
  })

  test('décliner deux fois échoue avec un message, sans changer d’état', async ({
    client,
    assert,
  }) => {
    const supplier = await OrganizationFactory.apply('supplier').create()
    const owner = await createMember(supplier, 'owner')
    const buyer = await OrganizationFactory.create()
    const rfq = await publishedRfq(buyer, supplier, 'declined')

    const response = await client
      .post(`/fr/supplier/rfqs/${rfq.id}/decline`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)

    response.assertStatus(200)
    const recipient = await RfqSupplier.findByOrFail('rfqId', rfq.id)
    assert.equal(recipient.status, 'declined')
  })

  test('un membre simple du fournisseur n’accède pas aux demandes reçues (403)', async ({
    client,
  }) => {
    const supplier = await OrganizationFactory.apply('supplier').create()
    const member = await createMember(supplier, 'member')

    const response = await client.get('/fr/supplier/rfqs').withInertia().loginAs(member)

    response.assertStatus(403)
  })

  test('une organisation purement acheteuse n’a pas d’écran fournisseur (403)', async ({
    client,
  }) => {
    const buyer = await OrganizationFactory.create()
    const owner = await createMember(buyer, 'owner')

    const response = await client.get('/fr/supplier/rfqs').withInertia().loginAs(owner)

    response.assertStatus(403)
  })
})
