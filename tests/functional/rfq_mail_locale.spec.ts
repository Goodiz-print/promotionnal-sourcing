import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import mail from '@adonisjs/mail/services/main'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqItemFactory } from '#database/factories/rfq_item_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import RfqReceivedNotification from '#mails/rfq_received_notification'
import SupplierProfile from '#models/supplier_profile'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type Rfq from '#models/rfq'
import type User from '#models/user'
import type { Locale } from '#shared/types/i18n'
import type { RfqReceivedMailData } from '#shared/types/mail'

interface Sent {
  email: string
  locale: string
  data: RfqReceivedMailData
}

/**
 * Mail « demande reçue » (#58) : chaque destinataire est écrit dans **sa**
 * langue — texte, lien et échéance — quelle que soit celle de l'acheteur.
 */
async function publishedRfqTo(supplierId: number, buyerOwner: User, buyerOrgId: number) {
  const rfq: Rfq = await RfqFactory.merge({ buyerOrganizationId: buyerOrgId }).create()
  await RfqItemFactory.merge({ rfqId: rfq.id }).create()
  await RfqSupplierFactory.merge({
    rfqId: rfq.id,
    supplierOrganizationId: supplierId,
    status: 'pending',
  }).create()
  return { rfq, owner: buyerOwner }
}

async function memberWithLocale(
  org: Parameters<typeof createMember>[0],
  role: 'owner' | 'manager',
  locale: Locale
) {
  const user = await createMember(org, role)
  await user.merge({ locale }).save()
  return user
}

async function sendAs(client: ApiClient, rfq: Rfq, owner: User): Promise<Sent[]> {
  await client.post(`/fr/rfqs/${rfq.id}/publish`).withInertia().withCsrfToken().loginAs(owner)
  const { mails } = mail.fake()
  try {
    await client.post(`/fr/rfqs/${rfq.id}/send`).withInertia().withCsrfToken().loginAs(owner)
    return mails.sent((mailer) => mailer instanceof RfqReceivedNotification) as unknown as Sent[]
  } finally {
    mail.restore()
  }
}

test.group('Mail RFQ — langue du destinataire', (group) => {
  useDatabase(group)

  test('chaque membre habilité reçoit le mail dans sa langue, avec son lien', async ({
    client,
    assert,
  }) => {
    const buyer = await OrganizationFactory.create()
    const buyerOwner = await createMember(buyer, 'owner')
    const supplier = await OrganizationFactory.apply('supplier').create()
    const english = await memberWithLocale(supplier, 'manager', 'en')
    const german = await memberWithLocale(supplier, 'owner', 'de')
    const { rfq } = await publishedRfqTo(supplier.id, buyerOwner, buyer.id)

    const sent = await sendAs(client, rfq, buyerOwner)

    assert.lengthOf(sent, 2)
    const toEnglish = sent.find((row) => row.email === english.email)!
    const toGerman = sent.find((row) => row.email === german.email)!
    assert.equal(toEnglish.locale, 'en')
    assert.equal(toEnglish.data.rfqPath, `/en/supplier/rfqs/${rfq.id}`)
    assert.equal(toGerman.locale, 'de')
    assert.equal(toGerman.data.rfqPath, `/de/supplier/rfqs/${rfq.id}`)
  })

  test('une adresse de contact prend la langue du premier membre habilité', async ({
    client,
    assert,
  }) => {
    const buyer = await OrganizationFactory.create()
    const buyerOwner = await createMember(buyer, 'owner')
    const supplier = await OrganizationFactory.apply('supplier')
      .merge({ email: 'contact@fournisseur.test' })
      .create()
    await memberWithLocale(supplier, 'owner', 'it')
    const { rfq } = await publishedRfqTo(supplier.id, buyerOwner, buyer.id)

    const sent = await sendAs(client, rfq, buyerOwner)

    assert.lengthOf(sent, 1)
    assert.equal(sent[0].email, 'contact@fournisseur.test')
    assert.equal(sent[0].locale, 'it')
    assert.equal(sent[0].data.rfqPath, `/it/supplier/rfqs/${rfq.id}`)
  })

  test('sans membre habilité, la langue par défaut s’applique', async ({ client, assert }) => {
    const buyer = await OrganizationFactory.create()
    const buyerOwner = await createMember(buyer, 'owner')
    const supplier = await OrganizationFactory.apply('supplier')
      .merge({ email: 'contact@fournisseur.test' })
      .create()
    const { rfq } = await publishedRfqTo(supplier.id, buyerOwner, buyer.id)

    const sent = await sendAs(client, rfq, buyerOwner)

    assert.equal(sent[0].locale, 'fr')
    assert.equal(sent[0].data.rfqPath, `/fr/supplier/rfqs/${rfq.id}`)
  })
})

/**
 * Adresse de réception (#217) : `supplier_profiles.quote_email` prime, puis
 * l'adresse de contact de l'organisation, puis les membres responsables.
 */
test.group('Mail RFQ — adresse de réception', (group) => {
  useDatabase(group)

  async function supplierWith(emails: {
    contact: string | null
    quote: string | null
    verified?: boolean
  }) {
    const supplier = await OrganizationFactory.apply('supplier')
      .merge({ email: emails.contact })
      .create()
    await SupplierProfile.create({
      organizationId: supplier.id,
      quoteEmail: emails.quote,
      quoteEmailVerifiedAt: emails.verified === false ? null : DateTime.now(),
    })
    const manager = await memberWithLocale(supplier, 'manager', 'en')
    return { supplier, manager }
  }

  async function sentTo(client: ApiClient, supplierId: number): Promise<Sent[]> {
    const buyer = await OrganizationFactory.create()
    const buyerOwner = await createMember(buyer, 'owner')
    const { rfq } = await publishedRfqTo(supplierId, buyerOwner, buyer.id)
    return sendAs(client, rfq, buyerOwner)
  }

  test('l’adresse de réception du profil prime sur le contact et les membres', async ({
    client,
    assert,
  }) => {
    const { supplier } = await supplierWith({
      contact: 'contact@fournisseur.test',
      quote: 'devis@fournisseur.test',
    })

    const sent = await sentTo(client, supplier.id)

    assert.deepEqual(
      sent.map(({ email, locale }) => ({ email, locale })),
      [{ email: 'devis@fournisseur.test', locale: 'en' }]
    )
  })

  test('une adresse de réception non confirmée laisse le mail partir au contact', async ({
    client,
    assert,
  }) => {
    const { supplier } = await supplierWith({
      contact: 'contact@fournisseur.test',
      quote: 'devis@fournisseur.test',
      verified: false,
    })

    const sent = await sentTo(client, supplier.id)

    assert.deepEqual(
      sent.map(({ email }) => email),
      ['contact@fournisseur.test']
    )
  })

  test('sans adresse de réception, le mail part à l’adresse de contact', async ({
    client,
    assert,
  }) => {
    const { supplier } = await supplierWith({ contact: 'contact@fournisseur.test', quote: null })

    const sent = await sentTo(client, supplier.id)

    assert.deepEqual(
      sent.map(({ email }) => email),
      ['contact@fournisseur.test']
    )
  })

  test('sans aucune adresse explicite, les membres responsables sont prévenus', async ({
    client,
    assert,
  }) => {
    const { supplier, manager } = await supplierWith({ contact: null, quote: null })

    const sent = await sentTo(client, supplier.id)

    assert.deepEqual(
      sent.map(({ email }) => email),
      [manager.email]
    )
  })
})
