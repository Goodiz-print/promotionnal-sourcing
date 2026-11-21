import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import mail from '@adonisjs/mail/services/main'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { ProductFactory } from '#database/factories/product_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqItemFactory } from '#database/factories/rfq_item_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'
import RemindRfqSuppliersJob from '#jobs/remind_rfq_suppliers_job'
import RfqReceivedNotification from '#mails/rfq_received_notification'
import RfqReminderNotification from '#mails/rfq_reminder_notification'
import Rfq from '#models/rfq'
import { createMember, subscribeOrganization } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type Organization from '#models/organization'
import type User from '#models/user'
import type { RfqReceivedMailData, RfqReminderMailData } from '#shared/types/mail'

/**
 * Coordonnées de l'agence transmises aux fournisseurs abonnés (#221) : à
 * l'écran (prop `rfq.buyerContact`) et dans les mails de demande et de
 * relance. Un non abonné n'en reçoit aucune (#220).
 */
const AGENCY = {
  name: 'Agence Zorglub Événements',
  email: 'contact@zorglub.test',
  phone: '+33 1 23 45 67 89',
  addressLine1: '12 rue des Lilas',
  addressLine2: null,
  postalCode: '75011',
  city: 'Paris',
  country: 'FR',
}

const AUTHOR = { firstName: 'Alice', lastName: 'Martin', email: 'alice@zorglub.test' }

interface Scenario {
  buyer: Organization
  author: User
  supplier: Organization
  supplierOwner: User
}

interface ScenarioOptions {
  /** `null` : l'agence n'a pas saisi d'email de contact. */
  agencyEmail?: string | null
  /** Unique par scénario : un test peut en monter deux. */
  authorEmail?: string
}

async function scenario(options: ScenarioOptions = {}): Promise<Scenario> {
  const { agencyEmail = AGENCY.email, authorEmail = AUTHOR.email } = options
  const buyer = await OrganizationFactory.merge({ ...AGENCY, email: agencyEmail }).create()
  const supplier = await OrganizationFactory.apply('supplier')
    .merge({ email: 'devis@fournisseur.test' })
    .create()
  return {
    buyer,
    author: await createMember(buyer, 'owner', { ...AUTHOR, email: authorEmail }),
    supplier,
    supplierOwner: await createMember(supplier, 'owner'),
  }
}

/** Demande de `author` diffusée au fournisseur, il y a `sentDaysAgo` jours. */
async function receivedRfq({ buyer, author, supplier }: Scenario, sentDaysAgo = 0) {
  const rfq = await RfqFactory.apply('published')
    .merge({ buyerOrganizationId: buyer.id, createdByUserId: author.id })
    .create()
  await RfqItemFactory.merge({ rfqId: rfq.id }).create()
  await RfqSupplierFactory.merge({
    rfqId: rfq.id,
    supplierOrganizationId: supplier.id,
    status: 'sent',
    sentAt: DateTime.now().minus({ days: sentDaysAgo }),
  }).create()
  return rfq
}

async function detailProps(client: ApiClient, ctx: Scenario, rfqId: number) {
  const response = await client
    .get(`/fr/supplier/rfqs/${rfqId}`)
    .withInertia()
    .loginAs(ctx.supplierOwner)
  response.assertStatus(200)
  return { response, rfq: response.inertiaProps.rfq as Record<string, unknown> }
}

/** Mails de demande envoyés pendant `action`. */
async function receivedMails(action: () => Promise<unknown>): Promise<RfqReceivedMailData[]> {
  const { mails } = mail.fake()
  try {
    await action()
    const sent = mails.sent((mailer) => mailer instanceof RfqReceivedNotification)
    return sent.map((mailer) => (mailer as unknown as { data: RfqReceivedMailData }).data)
  } finally {
    mail.restore()
  }
}

/** Demande saisie au formulaire par `author`, puis publiée et envoyée. */
async function sendFromForm(client: ApiClient, { author, supplier }: Scenario) {
  const created = await client
    .post('/fr/rfqs')
    .withInertia()
    .withCsrfToken()
    .loginAs(author)
    .json({
      title: 'Tote bags coton bio',
      items: [{ name: 'Tote bag', quantity: 500 }],
      supplierOrganizationIds: [supplier.id],
    })
  created.assertStatus(200)
  const rfq = await Rfq.query().where('title', 'Tote bags coton bio').firstOrFail()
  await client.post(`/fr/rfqs/${rfq.id}/publish`).withInertia().withCsrfToken().loginAs(author)
  const data = await receivedMails(() =>
    client.post(`/fr/rfqs/${rfq.id}/send`).withInertia().withCsrfToken().loginAs(author)
  )
  return { rfq, data }
}

/** Produit du fournisseur mis au panier par `member`, puis panier validé. */
async function sendFromCart(client: ApiClient, { supplier }: Scenario, member: User) {
  const catalog = await SupplierFactory.merge({ organizationId: supplier.id }).create()
  const product = await ProductFactory.merge({ supplierId: catalog.id, minQuantity: 100 })
    .with('category')
    .create()
  await client
    .post('/fr/quote-cart/items')
    .withInertia()
    .withCsrfToken()
    .redirects(0)
    .loginAs(member)
    .json({ productId: product.id })
  const data = await receivedMails(() =>
    client
      .post('/fr/quote-cart/checkout')
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(member)
      .json({ title: 'Kit onboarding' })
  )
  // Le panier suffixe le titre du nom du fournisseur : on retrouve la demande par son agence.
  const rfq = await Rfq.query()
    .where('buyerOrganizationId', member.currentOrganizationId!)
    .firstOrFail()
  return { rfq, data }
}

const EXPECTED_CONTACT = {
  agencyName: AGENCY.name,
  requesterName: 'Alice Martin',
  email: AGENCY.email,
  phone: AGENCY.phone,
  addressLines: ['12 rue des Lilas', '75011 Paris', 'France'],
}

test.group('Coordonnées de l’agence — écran fournisseur', (group) => {
  useDatabase(group)

  test('un abonné lit le nom, l’auteur, l’email, le téléphone et l’adresse', async ({
    client,
    assert,
  }) => {
    const ctx = await scenario()
    const rfq = await receivedRfq(ctx)
    await subscribeOrganization(ctx.supplier)

    const { rfq: props } = await detailProps(client, ctx, rfq.id)

    assert.deepEqual(props.buyerContact, EXPECTED_CONTACT)
  })

  test('un non abonné ne reçoit aucune coordonnée', async ({ client, assert }) => {
    const ctx = await scenario()
    const rfq = await receivedRfq(ctx)

    const { response, rfq: props } = await detailProps(client, ctx, rfq.id)

    assert.isNull(props.buyerContact)
    const secrets = [AGENCY.email, AGENCY.phone, AGENCY.addressLine1, 'Alice', 'Martin']
    secrets.forEach((secret) => assert.notInclude(response.text(), secret))
  })

  test('sans email de contact, l’agence se rabat sur l’email de l’auteur', async ({
    client,
    assert,
  }) => {
    const ctx = await scenario({ agencyEmail: null })
    const rfq = await receivedRfq(ctx)
    await subscribeOrganization(ctx.supplier)

    const { rfq: props } = await detailProps(client, ctx, rfq.id)

    assert.equal((props.buyerContact as { email: string }).email, AUTHOR.email)
  })

  test('s’abonner révèle les coordonnées d’une demande reçue avant', async ({ client, assert }) => {
    const ctx = await scenario()
    const rfq = await receivedRfq(ctx, 10)

    const before = await detailProps(client, ctx, rfq.id)
    assert.isNull(before.rfq.buyerContact)

    await subscribeOrganization(ctx.supplier)
    const after = await detailProps(client, ctx, rfq.id)
    assert.deepEqual(after.rfq.buyerContact, EXPECTED_CONTACT)
  })

  test('une demande sans auteur connu garde l’agence, sans auteur ni repli', async ({
    client,
    assert,
  }) => {
    const ctx = await scenario({ agencyEmail: null })
    const rfq = await receivedRfq(ctx)
    await rfq.merge({ createdByUserId: null }).save()
    await subscribeOrganization(ctx.supplier)

    const { rfq: props } = await detailProps(client, ctx, rfq.id)

    assert.containSubset(props.buyerContact, {
      agencyName: AGENCY.name,
      requesterName: null,
      email: null,
    })
  })
})

test.group('Coordonnées de l’agence — mails de demande et de relance', (group) => {
  useDatabase(group)

  test('une demande saisie au formulaire part avec les coordonnées chez un abonné', async ({
    client,
    assert,
  }) => {
    const ctx = await scenario()
    await subscribeOrganization(ctx.supplier)

    const { rfq, data } = await sendFromForm(client, ctx)

    assert.equal(rfq.createdByUserId, ctx.author.id)
    assert.lengthOf(data, 1)
    assert.deepEqual(data[0].buyerContact, EXPECTED_CONTACT)
  })

  test('une demande du panier nomme son auteur et se rabat sur son email', async ({
    client,
    assert,
  }) => {
    const ctx = await scenario({ agencyEmail: null })
    const member = await createMember(ctx.buyer, 'member', {
      firstName: 'Bruno',
      lastName: 'Durand',
      email: 'bruno@zorglub.test',
    })
    await subscribeOrganization(ctx.supplier)

    const { rfq, data } = await sendFromCart(client, ctx, member)

    assert.equal(rfq.createdByUserId, member.id)
    assert.lengthOf(data, 1)
    assert.containSubset(data[0].buyerContact, {
      requesterName: 'Bruno Durand',
      email: 'bruno@zorglub.test',
    })
  })

  test('un non abonné reçoit un mail sans aucune coordonnée', async ({ client, assert }) => {
    const ctx = await scenario()

    const { data } = await sendFromForm(client, ctx)

    assert.lengthOf(data, 1)
    assert.isNull(data[0].buyerContact)
    const payload = JSON.stringify(data[0])
    const secrets = [AGENCY.email, AGENCY.phone, AGENCY.addressLine1, 'Alice']
    secrets.forEach((secret) => assert.notInclude(payload, secret))
  })

  test('la relance porte les coordonnées chez un abonné, pas chez un non abonné', async ({
    assert,
  }) => {
    const anonymous = await scenario()
    await receivedRfq(anonymous, 4)
    const subscribed = await scenario({ authorEmail: 'alice.bis@zorglub.test' })
    await receivedRfq(subscribed, 4)
    await subscribeOrganization(subscribed.supplier)

    const { mails } = mail.fake()
    let sent: RfqReminderMailData[]
    try {
      await new RemindRfqSuppliersJob().execute()
      sent = mails
        .sent((mailer) => mailer instanceof RfqReminderNotification)
        .map((mailer) => (mailer as unknown as { data: RfqReminderMailData }).data)
    } finally {
      mail.restore()
    }

    assert.lengthOf(sent, 2)
    const withContact = sent.filter((data) => data.buyerContact)
    assert.lengthOf(withContact, 1)
    assert.deepEqual(withContact[0].buyerContact, EXPECTED_CONTACT)
  })
})
