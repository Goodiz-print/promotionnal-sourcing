import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import mail from '@adonisjs/mail/services/main'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { QuoteFactory } from '#database/factories/quote_factory'
import { QuoteItemFactory } from '#database/factories/quote_item_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqItemFactory } from '#database/factories/rfq_item_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import ExpireRfqsJob from '#jobs/expire_rfqs_job'
import QuoteReceivedNotification from '#mails/quote_received_notification'
import Quote from '#models/quote'
import QuoteItem from '#models/quote_item'
import type Rfq from '#models/rfq'
import RfqSupplier from '#models/rfq_supplier'
import QuoteService from '#services/quote_service'
import {
  QuoteAlreadyExistsException,
  QuoteInvalidItemsException,
  QuoteInvalidValidityException,
  QuoteNotAllowedException,
  QuoteNotDecidableException,
  QuoteNotEditableException,
  QuoteNotFoundException,
  QuoteNotSubmittableException,
} from '#exceptions/quote_errors'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type Organization from '#models/organization'
import type { QuoteData } from '#shared/types/quote'
import type { RfqSupplierStatus } from '#shared/types/rfq'

/**
 * Devis fournisseur (#5) : saisie d'un brouillon, remise, comparaison et
 * décision de l'acheteur. Les montants sont toujours recalculés côté serveur.
 */
/**
 * Sans mailer factice, la remise d'un devis enverrait un vrai mail (SMTP absent
 * en test : le job réessaierait en boucle).
 */
let sentMails: ReturnType<typeof mail.fake>['mails']

function fakeMails(group: Parameters<typeof useDatabase>[0]) {
  group.each.setup(() => {
    sentMails = mail.fake().mails
    return () => mail.restore()
  })
}

async function scenario(recipientStatus: RfqSupplierStatus = 'viewed') {
  const buyer = await OrganizationFactory.create()
  const buyerOwner = await createMember(buyer, 'owner')
  const supplier = await OrganizationFactory.apply('supplier').create()
  const supplierOwner = await createMember(supplier, 'owner')
  const rfq = await RfqFactory.apply('published').merge({ buyerOrganizationId: buyer.id }).create()
  const tote = await RfqItemFactory.merge({
    rfqId: rfq.id,
    name: 'Tote bag',
    quantity: 500,
  }).create()
  const mug = await RfqItemFactory.merge({ rfqId: rfq.id, name: 'Mug', quantity: 200 }).create()
  await RfqSupplierFactory.merge({
    rfqId: rfq.id,
    supplierOrganizationId: supplier.id,
    status: recipientStatus,
    sentAt: DateTime.now(),
  }).create()
  const service = await app.container.make(QuoteService)
  return { buyer, buyerOwner, supplier, supplierOwner, rfq, tote, mug, service }
}

function form(items: Array<{ rfqItemId: number }>, overrides: Partial<QuoteData> = {}): QuoteData {
  return {
    notes: 'Franco de port',
    items: items.map(({ rfqItemId }) => ({
      rfqItemId,
      unitPrice: 1.2345,
      quantity: 100,
      leadTimeDays: 15,
    })),
    ...overrides,
  }
}

/** Un second fournisseur destinataire de la même demande. */
async function otherSupplier(rfq: Rfq): Promise<Organization> {
  const org = await OrganizationFactory.apply('supplier').create()
  await RfqSupplierFactory.apply('sent')
    .merge({ rfqId: rfq.id, supplierOrganizationId: org.id })
    .create()
  return org
}

async function submittedQuote(
  service: QuoteService,
  rfq: Rfq,
  supplier: Organization,
  items: Array<{ rfqItemId: number }>
) {
  const quote = await service.createDraft(rfq.id, supplier.id, form(items))
  return service.submit(quote)
}

test.group('Devis — brouillon', (group) => {
  useDatabase(group)
  fakeMails(group)

  test('calcule les totaux côté serveur, au centime', async ({ assert }) => {
    const { service, supplier, rfq, tote, mug } = await scenario()

    const quote = await service.createDraft(rfq.id, supplier.id, {
      items: [
        { rfqItemId: tote.id, unitPrice: 1.2345, quantity: 100, leadTimeDays: 15 },
        { rfqItemId: mug.id, unitPrice: 3, quantity: 3, leadTimeDays: 30 },
      ],
    })

    const items = await QuoteItem.query().where('quoteId', quote.id).orderBy('id')
    assert.equal(items[0].totalPrice, '123.45')
    assert.equal(items[0].unitPrice, '1.2345')
    assert.equal(items[1].totalPrice, '9.00')
    assert.equal(quote.status, 'draft')
    assert.equal(quote.totalAmount, '132.45')
    assert.equal(quote.currency, 'EUR')
  })

  test('reprend le produit du catalogue de la ligne de la demande, pas du client', async ({
    assert,
  }) => {
    const { service, supplier, rfq, tote } = await scenario()

    const quote = await service.createDraft(rfq.id, supplier.id, form([{ rfqItemId: tote.id }]))

    const [item] = await QuoteItem.query().where('quoteId', quote.id)
    assert.equal(item.productId, tote.productId)
  })

  test('refuse une ligne qui n’appartient pas à la demande, ou répétée, ou aucune ligne', async ({
    assert,
  }) => {
    const { service, supplier, rfq, tote, buyer } = await scenario()
    const foreignRfq = await RfqFactory.apply('published')
      .merge({ buyerOrganizationId: buyer.id })
      .create()
    const foreignItem = await RfqItemFactory.merge({ rfqId: foreignRfq.id }).create()

    await assert.rejects(
      () => service.createDraft(rfq.id, supplier.id, form([{ rfqItemId: foreignItem.id }])),
      QuoteInvalidItemsException
    )
    await assert.rejects(
      () =>
        service.createDraft(
          rfq.id,
          supplier.id,
          form([{ rfqItemId: tote.id }, { rfqItemId: tote.id }])
        ),
      QuoteInvalidItemsException
    )
    await assert.rejects(
      () => service.createDraft(rfq.id, supplier.id, form([])),
      QuoteInvalidItemsException
    )
    assert.lengthOf(await Quote.all(), 0)
  })

  test('refuse un fournisseur qui n’est pas destinataire ou qui a décliné', async ({ assert }) => {
    const { service, rfq, tote } = await scenario()
    const outsider = await OrganizationFactory.apply('supplier').create()
    const decliner = await otherSupplier(rfq)
    await RfqSupplier.query()
      .where('rfqId', rfq.id)
      .where('supplierOrganizationId', decliner.id)
      .update({ status: 'declined' })

    await assert.rejects(
      () => service.createDraft(rfq.id, outsider.id, form([{ rfqItemId: tote.id }])),
      'Request for quotation not found'
    )
    await assert.rejects(
      () => service.createDraft(rfq.id, decliner.id, form([{ rfqItemId: tote.id }])),
      QuoteNotAllowedException
    )
  })

  test('refuse une demande non ouverte : close, échue ou échéance passée', async ({ assert }) => {
    const { service, supplier, rfq, tote } = await scenario()
    const data = form([{ rfqItemId: tote.id }])

    await rfq.merge({ deadline: DateTime.now().minus({ days: 2 }) }).save()
    await assert.rejects(
      () => service.createDraft(rfq.id, supplier.id, data),
      QuoteNotAllowedException
    )

    await rfq.merge({ deadline: null, status: 'closed' }).save()
    await assert.rejects(
      () => service.createDraft(rfq.id, supplier.id, data),
      QuoteNotAllowedException
    )

    await rfq.merge({ status: 'expired' }).save()
    await assert.rejects(
      () => service.createDraft(rfq.id, supplier.id, data),
      QuoteNotAllowedException
    )
  })

  test('un seul devis vivant par fournisseur et par demande', async ({ assert }) => {
    const { service, supplier, rfq, tote } = await scenario()
    await service.createDraft(rfq.id, supplier.id, form([{ rfqItemId: tote.id }]))

    await assert.rejects(
      () => service.createDraft(rfq.id, supplier.id, form([{ rfqItemId: tote.id }])),
      QuoteAlreadyExistsException
    )
  })

  test('refuse une date de validité passée', async ({ assert }) => {
    const { service, supplier, rfq, tote } = await scenario()

    await assert.rejects(
      () =>
        service.createDraft(
          rfq.id,
          supplier.id,
          form([{ rfqItemId: tote.id }], { validUntil: '2020-01-01' })
        ),
      QuoteInvalidValidityException
    )
  })

  test('met à jour un brouillon en remplaçant ses lignes, jamais un devis remis', async ({
    assert,
  }) => {
    const { service, supplier, rfq, tote, mug } = await scenario()
    const quote = await service.createDraft(rfq.id, supplier.id, form([{ rfqItemId: tote.id }]))

    await service.updateDraft(quote, {
      notes: 'Mis à jour',
      items: [{ rfqItemId: mug.id, unitPrice: 2, quantity: 10, leadTimeDays: 7 }],
    })

    const items = await QuoteItem.query().where('quoteId', quote.id)
    assert.lengthOf(items, 1)
    assert.equal(items[0].rfqItemId, mug.id)
    assert.equal(quote.totalAmount, '20.00')
    assert.equal(quote.notes, 'Mis à jour')

    await service.submit(quote)
    await assert.rejects(
      () => service.updateDraft(quote, form([{ rfqItemId: tote.id }])),
      QuoteNotEditableException
    )
    await assert.rejects(() => service.deleteDraft(quote), QuoteNotEditableException)
  })

  test('supprime un brouillon avec ses lignes', async ({ assert }) => {
    const { service, supplier, rfq, tote } = await scenario()
    const quote = await service.createDraft(rfq.id, supplier.id, form([{ rfqItemId: tote.id }]))

    await service.deleteDraft(quote)

    assert.lengthOf(await Quote.all(), 0)
    assert.lengthOf(await QuoteItem.all(), 0)
  })
})

test.group('Devis — remise', (group) => {
  useDatabase(group)
  fakeMails(group)

  test('remettre le devis passe le destinataire en « responded » et prévient l’acheteur', async ({
    assert,
  }) => {
    const { service, supplier, rfq, tote, buyerOwner } = await scenario()
    const quote = await service.createDraft(rfq.id, supplier.id, form([{ rfqItemId: tote.id }]))

    await service.submit(quote)

    const sent = sentMails.sent((mailer) => mailer instanceof QuoteReceivedNotification)
    assert.lengthOf(sent, 1)

    assert.equal(quote.status, 'submitted')
    assert.isNotNull(quote.submittedAt)
    const recipient = await RfqSupplier.findByOrFail('supplierOrganizationId', supplier.id)
    assert.equal(recipient.status, 'responded')
    assert.isOk(buyerOwner.email)
  })

  test('refuse un devis sans ligne, déjà remis, ou dont la validité est passée', async ({
    assert,
  }) => {
    const { service, supplier, rfq, tote } = await scenario()
    const empty = await QuoteFactory.merge({
      rfqId: rfq.id,
      supplierOrganizationId: supplier.id,
    }).create()
    await assert.rejects(() => service.submit(empty), QuoteNotSubmittableException)

    await empty.delete()
    const quote = await service.createDraft(rfq.id, supplier.id, form([{ rfqItemId: tote.id }]))
    await quote.merge({ validUntil: DateTime.now().minus({ days: 3 }) }).save()
    await assert.rejects(() => service.submit(quote), QuoteNotSubmittableException)

    await quote.merge({ validUntil: null }).save()
    await service.submit(quote)
    await assert.rejects(() => service.submit(quote), QuoteNotSubmittableException)
  })

  test('refuse la remise quand la demande n’accepte plus de réponse', async ({ assert }) => {
    const { service, supplier, rfq, tote } = await scenario()
    const quote = await service.createDraft(rfq.id, supplier.id, form([{ rfqItemId: tote.id }]))

    await rfq.merge({ status: 'closed' }).save()

    await assert.rejects(() => service.submit(quote), QuoteNotAllowedException)
    await quote.refresh()
    assert.equal(quote.status, 'draft')
  })
})

test.group('Devis — décision de l’acheteur', (group) => {
  useDatabase(group)
  fakeMails(group)

  test('accepter un devis rejette les autres et clôture la demande', async ({ assert }) => {
    const { service, supplier, rfq, tote } = await scenario()
    const rival = await otherSupplier(rfq)
    const winner = await submittedQuote(service, rfq, supplier, [{ rfqItemId: tote.id }])
    const loser = await submittedQuote(service, rfq, rival, [{ rfqItemId: tote.id }])
    // Un brouillon d'un troisième fournisseur n'est pas concerné.
    const third = await otherSupplier(rfq)
    const draft = await service.createDraft(rfq.id, third.id, form([{ rfqItemId: tote.id }]))

    const rejected = await service.accept(winner)

    assert.deepEqual(
      rejected.map((quote) => quote.id),
      [loser.id]
    )
    await winner.refresh()
    await loser.refresh()
    await draft.refresh()
    await rfq.refresh()
    assert.equal(winner.status, 'accepted')
    assert.isNotNull(winner.decidedAt)
    assert.equal(loser.status, 'rejected')
    assert.equal(draft.status, 'draft')
    assert.equal(rfq.status, 'closed')
    assert.isNotNull(rfq.closedAt)
  })

  test('une seule décision gagne : le second accept échoue et rien ne change', async ({
    assert,
  }) => {
    const { service, supplier, rfq, tote } = await scenario()
    const rival = await otherSupplier(rfq)
    const first = await submittedQuote(service, rfq, supplier, [{ rfqItemId: tote.id }])
    const second = await submittedQuote(service, rfq, rival, [{ rfqItemId: tote.id }])

    await service.accept(first)

    await assert.rejects(() => service.accept(second), QuoteNotDecidableException)
    await first.refresh()
    assert.equal(first.status, 'accepted')
  })

  test('rejeter un devis laisse la demande ouverte et les autres devis en lice', async ({
    assert,
  }) => {
    const { service, supplier, rfq, tote } = await scenario()
    const rival = await otherSupplier(rfq)
    const refused = await submittedQuote(service, rfq, supplier, [{ rfqItemId: tote.id }])
    const other = await submittedQuote(service, rfq, rival, [{ rfqItemId: tote.id }])

    await service.reject(refused)

    await other.refresh()
    await rfq.refresh()
    assert.equal(refused.status, 'rejected')
    assert.equal(other.status, 'submitted')
    assert.equal(rfq.status, 'published')
    await assert.rejects(() => service.reject(refused), QuoteNotDecidableException)
    await assert.rejects(() => service.accept(refused), QuoteNotDecidableException)
  })

  test('un brouillon ne se décide pas, et l’acheteur ne le voit pas', async ({ assert }) => {
    const { service, supplier, rfq, tote, buyer } = await scenario()
    const draft = await service.createDraft(rfq.id, supplier.id, form([{ rfqItemId: tote.id }]))

    await assert.rejects(() => service.accept(draft), QuoteNotDecidableException)
    await assert.rejects(() => service.findForBuyer(draft.id, buyer.id), QuoteNotFoundException)
    assert.lengthOf(await service.listForRfq(rfq.id), 0)
  })

  test('liste les devis remis du moins cher au plus cher', async ({ assert }) => {
    const { service, supplier, rfq, tote } = await scenario()
    const rival = await otherSupplier(rfq)
    const expensive = await submittedQuote(service, rfq, supplier, [{ rfqItemId: tote.id }])
    const cheap = await service.createDraft(rfq.id, rival.id, {
      items: [{ rfqItemId: tote.id, unitPrice: 0.5, quantity: 100, leadTimeDays: 10 }],
    })
    await service.submit(cheap)

    const quotes = await service.listForRfq(rfq.id)

    assert.deepEqual(
      quotes.map((quote) => quote.id),
      [cheap.id, expensive.id]
    )
  })

  test('le devis d’une autre organisation est introuvable, côté acheteur comme fournisseur', async ({
    assert,
  }) => {
    const { service, supplier, rfq, tote } = await scenario()
    const quote = await submittedQuote(service, rfq, supplier, [{ rfqItemId: tote.id }])
    const strangerBuyer = await OrganizationFactory.create()
    const strangerSupplier = await OrganizationFactory.apply('supplier').create()

    await assert.rejects(
      () => service.findForBuyer(quote.id, strangerBuyer.id),
      QuoteNotFoundException
    )
    await assert.rejects(
      () => service.findForSupplier(quote.id, strangerSupplier.id),
      QuoteNotFoundException
    )
  })
})

test.group('Devis — expiration', (group) => {
  useDatabase(group)
  fakeMails(group)

  test('l’expiration d’une demande fait expirer brouillons et devis remis, pas les décidés', async ({
    assert,
  }) => {
    const { service, supplier, rfq, tote } = await scenario()
    const rival = await otherSupplier(rfq)
    const third = await otherSupplier(rfq)
    const submitted = await submittedQuote(service, rfq, supplier, [{ rfqItemId: tote.id }])
    const draft = await service.createDraft(rfq.id, rival.id, form([{ rfqItemId: tote.id }]))
    // Sans l'état `submitted` de la fabrique : il écraserait le statut demandé.
    const rejected = await QuoteFactory.merge({
      rfqId: rfq.id,
      supplierOrganizationId: third.id,
      status: 'rejected',
    }).create()
    await QuoteItemFactory.merge({ quoteId: rejected.id, rfqItemId: tote.id }).create()

    const count = await service.expireForRfqs([rfq.id])

    assert.equal(count, 2)
    await submitted.refresh()
    await draft.refresh()
    await rejected.refresh()
    assert.equal(submitted.status, 'expired')
    assert.equal(draft.status, 'expired')
    assert.equal(rejected.status, 'rejected')
  })

  test('une validité dépassée fait expirer le devis, le jour même non', async ({ assert }) => {
    const { service, supplier, rfq, tote } = await scenario()
    const rival = await otherSupplier(rfq)
    const stale = await submittedQuote(service, rfq, supplier, [{ rfqItemId: tote.id }])
    const today = await submittedQuote(service, rfq, rival, [{ rfqItemId: tote.id }])
    await stale.merge({ validUntil: DateTime.now().minus({ days: 2 }) }).save()
    await today.merge({ validUntil: DateTime.now().setZone('Europe/Paris') }).save()

    await service.expireOutdated()

    await stale.refresh()
    await today.refresh()
    assert.equal(stale.status, 'expired')
    assert.equal(today.status, 'submitted')
  })

  test('le job d’expiration des demandes fait aussi expirer leurs devis', async ({ assert }) => {
    const { service, supplier, rfq, tote } = await scenario()
    const quote = await submittedQuote(service, rfq, supplier, [{ rfqItemId: tote.id }])
    await rfq.merge({ deadline: DateTime.now().minus({ days: 5 }) }).save()

    await new ExpireRfqsJob().execute()

    await rfq.refresh()
    await quote.refresh()
    assert.equal(rfq.status, 'expired')
    assert.equal(quote.status, 'expired')
  })
})

test.group('Devis — écrans', (group) => {
  useDatabase(group)
  fakeMails(group)

  test('le fournisseur crée, enregistre puis remet son devis ; l’acheteur le compare et l’accepte', async ({
    client,
    assert,
  }) => {
    const { supplierOwner, buyerOwner, rfq, tote, supplier } = await scenario()

    const created = await client
      .post(`/fr/supplier/rfqs/${rfq.id}/quotes`)
      .json({
        validUntil: null,
        notes: 'Merci',
        items: [{ rfqItemId: tote.id, unitPrice: 2, quantity: 500, leadTimeDays: 20 }],
      })
      .withInertia()
      .withCsrfToken()
      .loginAs(supplierOwner)
    created.assertStatus(200)

    const quote = await Quote.findByOrFail('supplierOrganizationId', supplier.id)
    assert.equal(quote.totalAmount, '1000.00')

    // Le brouillon est invisible de l'acheteur.
    const hidden = await client.get(`/fr/quotes/${quote.id}`).withInertia().loginAs(buyerOwner)
    hidden.assertStatus(404)

    await client
      .post(`/fr/supplier/quotes/${quote.id}/submit`)
      .withInertia()
      .withCsrfToken()
      .loginAs(supplierOwner)

    const page = await client.get(`/fr/rfqs/${rfq.id}`).withInertia().loginAs(buyerOwner)
    assert.lengthOf(page.inertiaProps.quotes, 1)
    assert.equal(page.inertiaProps.quotes[0].totalAmount, 1000)
    assert.equal(page.inertiaProps.quotes[0].supplierName, supplier.name)

    const detail = await client.get(`/fr/quotes/${quote.id}`).withInertia().loginAs(buyerOwner)
    detail.assertInertiaComponent('quotes/show')
    assert.isTrue(detail.inertiaProps.canDecide)

    await client
      .patch(`/fr/quotes/${quote.id}/accept`)
      .withInertia()
      .withCsrfToken()
      .loginAs(buyerOwner)

    await quote.refresh()
    assert.equal(quote.status, 'accepted')
  })

  test('un simple membre acheteur consulte le devis mais ne peut pas le décider', async ({
    client,
    assert,
  }) => {
    const { service, supplier, rfq, tote, buyer } = await scenario()
    const quote = await submittedQuote(service, rfq, supplier, [{ rfqItemId: tote.id }])
    const member = await createMember(buyer, 'member')

    const detail = await client.get(`/fr/quotes/${quote.id}`).withInertia().loginAs(member)
    detail.assertStatus(200)
    assert.isFalse(detail.inertiaProps.canDecide)

    // Refus par l'ability : la requête retombe sur une redirection, rien n'est écrit.
    await client
      .patch(`/fr/quotes/${quote.id}/accept`)
      .redirects(0)
      .withInertia()
      .withCsrfToken()
      .loginAs(member)
    await quote.refresh()
    assert.equal(quote.status, 'submitted')
  })

  test('un fournisseur étranger à la demande ne peut ni la chiffrer ni lire un devis', async ({
    client,
  }) => {
    const { service, supplier, rfq, tote } = await scenario()
    const quote = await submittedQuote(service, rfq, supplier, [{ rfqItemId: tote.id }])
    const stranger = await createMember(
      await OrganizationFactory.apply('supplier').create(),
      'owner'
    )

    const read = await client.get(`/fr/supplier/quotes/${quote.id}`).withInertia().loginAs(stranger)
    read.assertStatus(404)

    const write = await client
      .post(`/fr/supplier/rfqs/${rfq.id}/quotes`)
      .json({ items: [{ rfqItemId: tote.id, unitPrice: 1, quantity: 1, leadTimeDays: 1 }] })
      .withInertia()
      .withCsrfToken()
      .loginAs(stranger)
    write.assertStatus(404)
  })

  test('l’écran de la demande reçue renvoie vers le devis existant', async ({ client, assert }) => {
    const { service, supplier, supplierOwner, rfq, tote } = await scenario()
    const quote = await service.createDraft(rfq.id, supplier.id, form([{ rfqItemId: tote.id }]))

    const page = await client
      .get(`/fr/supplier/rfqs/${rfq.id}`)
      .withInertia()
      .loginAs(supplierOwner)

    assert.deepEqual(page.inertiaProps.quote, { id: quote.id, status: 'draft' })
    assert.isTrue(page.inertiaProps.canQuote)

    const create = await client
      .get(`/fr/supplier/rfqs/${rfq.id}/quotes/new`)
      .withInertia()
      .loginAs(supplierOwner)
    create.assertRedirectsTo(`/fr/supplier/quotes/${quote.id}`)
  })
})
