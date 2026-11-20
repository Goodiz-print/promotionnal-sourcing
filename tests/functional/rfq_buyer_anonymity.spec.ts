import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import mail from '@adonisjs/mail/services/main'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqItemFactory } from '#database/factories/rfq_item_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import RfqReceivedNotification from '#mails/rfq_received_notification'
import Notification from '#models/notification'
import { createMember, subscribeOrganization } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type Organization from '#models/organization'
import type Rfq from '#models/rfq'
import type User from '#models/user'
import type { RfqReceivedMailData } from '#shared/types/mail'

/**
 * Anonymat de l'agence pour un fournisseur non abonné (#220) et encart
 * d'abonnement (#222). Le nom de l'agence est assez singulier pour qu'aucune
 * autre donnée de la réponse ne le contienne par hasard.
 */
const BUYER_NAME = 'Agence Zorglub Événements'

interface Scenario {
  buyer: Organization
  buyerOwner: User
  supplier: Organization
  supplierOwner: User
}

async function scenario(): Promise<Scenario> {
  const buyer = await OrganizationFactory.merge({
    name: BUYER_NAME,
    logoUrl: 'https://cdn.test/zorglub.png',
  }).create()
  const supplier = await OrganizationFactory.apply('supplier')
    .merge({ email: 'contact@fournisseur.test' })
    .create()
  return {
    buyer,
    buyerOwner: await createMember(buyer, 'owner'),
    supplier,
    supplierOwner: await createMember(supplier, 'owner'),
  }
}

/** Demande déjà diffusée au fournisseur. */
async function receivedRfq({ buyer, supplier }: Scenario): Promise<Rfq> {
  const rfq = await RfqFactory.apply('published').merge({ buyerOrganizationId: buyer.id }).create()
  await RfqItemFactory.merge({ rfqId: rfq.id }).create()
  await RfqSupplierFactory.apply('sent')
    .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id })
    .create()
  return rfq
}

/** Demande prête à partir : l'acheteur la publie puis l'envoie. */
async function sentRfq(client: ApiClient, { buyer, buyerOwner, supplier }: Scenario) {
  const rfq = await RfqFactory.merge({ buyerOrganizationId: buyer.id, status: 'draft' }).create()
  await RfqItemFactory.merge({ rfqId: rfq.id }).create()
  await RfqSupplierFactory.merge({
    rfqId: rfq.id,
    supplierOrganizationId: supplier.id,
    status: 'pending',
  }).create()
  await client.post(`/fr/rfqs/${rfq.id}/publish`).withInertia().withCsrfToken().loginAs(buyerOwner)

  const { mails } = mail.fake()
  try {
    await client.post(`/fr/rfqs/${rfq.id}/send`).withInertia().withCsrfToken().loginAs(buyerOwner)
    const sent = mails.sent((mailer) => mailer instanceof RfqReceivedNotification)
    return sent.map((mailer) => (mailer as unknown as { data: RfqReceivedMailData }).data)
  } finally {
    mail.restore()
  }
}

test.group('Anonymat de l’agence — écrans fournisseur', (group) => {
  useDatabase(group)

  test('un non abonné ne reçoit ni le nom ni le logo de l’agence', async ({ client, assert }) => {
    const ctx = await scenario()
    const rfq = await receivedRfq(ctx)

    const urls = [
      '/fr/supplier/rfqs',
      `/fr/supplier/rfqs/${rfq.id}`,
      `/fr/supplier/rfqs/${rfq.id}/quotes/new`,
    ]
    const responses = await Promise.all(
      urls.map((url) => client.get(url).withInertia().loginAs(ctx.supplierOwner))
    )
    responses.forEach((response, index) => {
      response.assertStatus(200)
      assert.notInclude(response.text(), BUYER_NAME, urls[index])
      assert.notInclude(response.text(), 'zorglub.png', urls[index])
    })

    const list = await client.get('/fr/supplier/rfqs').withInertia().loginAs(ctx.supplierOwner)
    assert.isNull(list.inertiaProps.rfqs[0].buyerName)
    assert.deepEqual(list.inertiaProps.upsell, { canSubscribe: true })
  })

  test('un abonné voit l’agence, sans encart d’abonnement', async ({ client, assert }) => {
    const ctx = await scenario()
    const rfq = await receivedRfq(ctx)
    await subscribeOrganization(ctx.supplier)

    const detail = await client
      .get(`/fr/supplier/rfqs/${rfq.id}`)
      .withInertia()
      .loginAs(ctx.supplierOwner)

    assert.equal(detail.inertiaProps.rfq.buyerName, BUYER_NAME)
    assert.equal(detail.inertiaProps.rfq.buyerLogoUrl, 'https://cdn.test/zorglub.png')
    assert.isNull(detail.inertiaProps.upsell)
  })

  test('s’abonner révèle l’agence d’une demande déjà reçue ; l’expiration la masque', async ({
    client,
    assert,
  }) => {
    const ctx = await scenario()
    await receivedRfq(ctx)
    const buyerShown = async () => {
      const response = await client
        .get('/fr/supplier/rfqs')
        .withInertia()
        .loginAs(ctx.supplierOwner)
      return response.inertiaProps.rfqs[0].buyerName
    }

    assert.isNull(await buyerShown())

    const subscription = await subscribeOrganization(ctx.supplier)
    assert.equal(await buyerShown(), BUYER_NAME)

    await subscription
      .merge({ status: 'expired', endsAt: DateTime.now().minus({ days: 1 }) })
      .save()
    assert.isNull(await buyerShown())
  })

  test('un manager, qui ne peut pas souscrire, est renvoyé vers un administrateur', async ({
    client,
    assert,
  }) => {
    const ctx = await scenario()
    await receivedRfq(ctx)
    const manager = await createMember(ctx.supplier, 'manager')

    const list = await client.get('/fr/supplier/rfqs').withInertia().loginAs(manager)

    assert.deepEqual(list.inertiaProps.upsell, { canSubscribe: false })
  })
})

test.group('Anonymat de l’agence — mail et notification de demande', (group) => {
  useDatabase(group)

  test('un non abonné reçoit un mail et une notification sans l’agence', async ({
    client,
    assert,
  }) => {
    const ctx = await scenario()

    const [data] = await sentRfq(client, ctx)

    assert.isNull(data.buyerName)
    assert.equal(data.subscribePath, '/fr/supplier/subscription')
    assert.notInclude(JSON.stringify(data), BUYER_NAME)

    const notification = await Notification.query()
      .where('userId', ctx.supplierOwner.id)
      .where('type', 'rfq.received')
      .firstOrFail()
    assert.notProperty(notification.data, 'buyerName')
  })

  test('un abonné reçoit le mail et la notification au nom de l’agence', async ({
    client,
    assert,
  }) => {
    const ctx = await scenario()
    await subscribeOrganization(ctx.supplier)

    const [data] = await sentRfq(client, ctx)

    assert.equal(data.buyerName, BUYER_NAME)
    assert.isNull(data.subscribePath)

    const notification = await Notification.query()
      .where('userId', ctx.supplierOwner.id)
      .where('type', 'rfq.received')
      .firstOrFail()
    assert.equal(notification.data.buyerName, BUYER_NAME)
  })
})
