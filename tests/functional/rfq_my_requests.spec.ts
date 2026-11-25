import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { QuoteFactory } from '#database/factories/quote_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import { QuoteDocumentNotFoundException } from '#exceptions/quote_errors'
import { RfqNotClosableException } from '#exceptions/rfq_errors'
import Rfq from '#models/rfq'
import QuoteService from '#services/quote_service'
import RfqService from '#services/rfq_service'
import { createMember } from '#tests/utils/organizations'
import { receivedQuoteDocument } from '#tests/utils/quote_documents'
import { useDatabase } from '#tests/utils/setup'
import type Organization from '#models/organization'
import type QuoteDocument from '#models/quote_document'
import type User from '#models/user'
import type { QuoteDocumentType } from '#shared/types/quote'
import type { RfqBatchGroupType } from '#shared/types/rfq'
import type { RfqProgress, RfqStatus, RfqSupplierStatus } from '#shared/types/rfq'

const BATCH = '3f2b8c1e-4a5d-4e6f-9a7b-8c9d0e1f2a3b'

interface RfqOptions {
  title: string
  status?: RfqStatus
  author?: User
  batchId?: string | null
  createdAt?: DateTime
}

/**
 * Une agence (propriétaire, manager, membre simple) et un fournisseur.
 */
async function agency() {
  const org = await OrganizationFactory.create()
  const owner = await createMember(org, 'owner', { firstName: 'Olivia', lastName: 'Owner' })
  const manager = await createMember(org, 'manager', { firstName: 'Marc', lastName: 'Manager' })
  const member = await createMember(org, 'member', { firstName: 'Mia', lastName: 'Member' })
  const supplier = await OrganizationFactory.apply('supplier')
    .merge({ name: 'Textiles du Nord' })
    .create()
  return { org, owner, manager, member, supplier }
}

function rfqOf(org: Organization, options: RfqOptions): Promise<Rfq> {
  const { title, status = 'published', author, batchId = null, createdAt } = options
  return RfqFactory.merge({
    buyerOrganizationId: org.id,
    createdByUserId: author?.id ?? null,
    title,
    status,
    batchId,
    publishedAt: status === 'draft' ? null : DateTime.now(),
    ...(createdAt ? { createdAt } : {}),
  }).create()
}

function recipientOf(rfq: Rfq, supplier: Organization, status: RfqSupplierStatus = 'sent') {
  return RfqSupplierFactory.merge({
    rfqId: rfq.id,
    supplierOrganizationId: supplier.id,
    status,
    sentAt: DateTime.now(),
  }).create()
}

function titlesOf(groups: RfqBatchGroupType[]): string[] {
  return groups.flatMap((group) => group.rfqs.map((rfq) => rfq.title))
}

function list(client: ApiClient, user: User, query = '') {
  return client.get(`/fr/rfqs${query}`).withInertia().loginAs(user)
}

test.group('Mes demandes — RfqService (#228)', (group) => {
  useDatabase(group)

  test('filtre par auteur', async ({ assert }) => {
    const { org, owner, member } = await agency()
    await rfqOf(org, { title: 'De Olivia', author: owner })
    await rfqOf(org, { title: 'De Mia', author: member })
    const service = await app.container.make(RfqService)

    const rows = await service.listForBuyer(org.id, { authorId: member.id })

    assert.deepEqual(
      rows.map(({ title }) => title),
      ['De Mia']
    )
  })

  test('filtre par avancement : publiée, envoyée et répondue distinguées', async ({ assert }) => {
    const { org, supplier } = await agency()
    await rfqOf(org, { title: 'Brouillon', status: 'draft' })
    const notSent = await rfqOf(org, { title: 'Publiée' })
    await recipientOf(notSent, supplier, 'pending')
    const sent = await rfqOf(org, { title: 'Envoyée' })
    await recipientOf(sent, supplier, 'viewed')
    const answered = await rfqOf(org, { title: 'Répondue' })
    await recipientOf(answered, supplier, 'responded')
    await rfqOf(org, { title: 'Échue', status: 'expired' })
    await rfqOf(org, { title: 'Clôturée', status: 'closed' })
    const service = await app.container.make(RfqService)

    const titles = async (status: RfqProgress) => {
      const rows = await service.listForBuyer(org.id, { status })
      return rows.map(({ title }) => title)
    }

    assert.deepEqual(await titles('draft'), ['Brouillon'])
    assert.deepEqual(await titles('published'), ['Publiée'])
    assert.deepEqual(await titles('sent'), ['Envoyée'])
    assert.deepEqual(await titles('responded'), ['Répondue'])
    assert.deepEqual(await titles('expired'), ['Échue'])
    assert.deepEqual(await titles('closed'), ['Clôturée'])
    assert.lengthOf(await service.listForBuyer(org.id), 6)
  })

  test('compte devis remis et PDF sans compter les brouillons du fournisseur', async ({
    assert,
  }) => {
    const { org, supplier } = await agency()
    const rfq = await rfqOf(org, { title: 'Tote bags' })
    const recipient = await recipientOf(rfq, supplier, 'responded')
    await QuoteFactory.merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id }).create()
    await receivedQuoteDocument(rfq, recipient)
    const service = await app.container.make(RfqService)

    const [row] = await service.listForBuyer(org.id)

    // Le brouillon de devis reste le secret du fournisseur.
    assert.equal(Number(row.$extras.receivedQuotesCount), 0)
    assert.equal(Number(row.$extras.quoteDocumentsCount), 1)
    assert.lengthOf(row.suppliers, 1)
  })

  test('les auteurs proposés sont ceux des demandes de l’agence, et eux seuls', async ({
    assert,
  }) => {
    const { org, owner, member } = await agency()
    const other = await OrganizationFactory.create()
    const outsider = await createMember(other, 'owner')
    await rfqOf(org, { title: 'A', author: member })
    await rfqOf(org, { title: 'B', author: member })
    await rfqOf(org, { title: 'C', author: owner })
    await rfqOf(other, { title: 'Ailleurs', author: outsider })
    const service = await app.container.make(RfqService)

    const authors = await service.authorsForBuyer(org.id)

    assert.sameMembers(
      authors.map(({ id }) => id),
      [owner.id, member.id]
    )
  })

  test('close dans une transaction annulée laisse la demande ouverte', async ({ assert }) => {
    const { org } = await agency()
    const rfq = await rfqOf(org, { title: 'Tote bags' })
    const service = await app.container.make(RfqService)

    const trx = await db.transaction()
    await service.close(rfq, trx)
    await trx.rollback()

    const reloaded = await Rfq.findOrFail(rfq.id)
    assert.equal(reloaded.status, 'published')
    assert.isNull(reloaded.closedAt)
  })
})

test.group('Mes demandes — devis PDF, QuoteService (#228)', (group) => {
  useDatabase(group)

  test('documentsForRfq : les PDF de la demande seule, le plus récent en tête', async ({
    assert,
  }) => {
    const { org, supplier } = await agency()
    const rfq = await rfqOf(org, { title: 'Tote bags' })
    const otherRfq = await rfqOf(org, { title: 'Stylos' })
    const recipient = await recipientOf(rfq, supplier, 'responded')
    await receivedQuoteDocument(rfq, recipient, {
      filename: 'ancien.pdf',
      receivedAt: DateTime.now().minus({ days: 2 }),
    })
    await receivedQuoteDocument(rfq, recipient, { filename: 'nouveau.pdf' })
    await receivedQuoteDocument(otherRfq, await recipientOf(otherRfq, supplier))
    const quotes = await app.container.make(QuoteService)
    const rfqs = await app.container.make(RfqService)
    const loaded = await rfqs.findForBuyer(rfq.id, org.id)

    const documents = await quotes.documentsForRfq(loaded)

    assert.deepEqual(
      documents.map(({ attachment }) => attachment.filename),
      ['nouveau.pdf', 'ancien.pdf']
    )
    assert.equal(documents[0].rfqSupplier.supplierOrganization.name, 'Textiles du Nord')
  })

  test('findDocumentForDecision : le devis et sa demande ; inconnu, une 404', async ({
    assert,
  }) => {
    const { org, supplier } = await agency()
    const rfq = await rfqOf(org, { title: 'Tote bags' })
    const document = await receivedQuoteDocument(rfq, await recipientOf(rfq, supplier))
    const quotes = await app.container.make(QuoteService)

    const found = await quotes.findDocumentForDecision(document.id)

    assert.equal(found.id, document.id)
    assert.equal(found.rfq.buyerOrganizationId, org.id)
    await assert.rejects(
      () => quotes.findDocumentForDecision(999_999),
      QuoteDocumentNotFoundException.message
    )
  })

  test('selectDocument : retient le devis et clôture la demande', async ({ assert }) => {
    const { org, supplier } = await agency()
    const rfq = await rfqOf(org, { title: 'Tote bags' })
    const document = await receivedQuoteDocument(rfq, await recipientOf(rfq, supplier))
    const quotes = await app.container.make(QuoteService)

    await quotes.selectDocument(await quotes.findDocument(document.id))

    await rfq.refresh()
    await document.refresh()
    assert.equal(rfq.status, 'closed')
    assert.isNotNull(rfq.closedAt)
    assert.isNotNull(document.selectedAt)
  })

  test('selectDocument : une demande déjà close est refusée et rien n’est marqué', async ({
    assert,
  }) => {
    const { org, supplier } = await agency()
    const rfq = await rfqOf(org, { title: 'Tote bags', status: 'closed' })
    const document = await receivedQuoteDocument(rfq, await recipientOf(rfq, supplier))
    const quotes = await app.container.make(QuoteService)

    await assert.rejects(() => quotes.selectDocument(document), RfqNotClosableException.message)

    await document.refresh()
    assert.isNull(document.selectedAt)
  })
})

test.group('Mes demandes — écrans (#228)', (group) => {
  useDatabase(group)

  test('la liste regroupe les demandes d’un même panier, les autres restent seules', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await agency()
    const now = DateTime.now()
    await rfqOf(org, { title: 'Seule', createdAt: now.minus({ hours: 2 }) })
    await rfqOf(org, { title: 'Panier A', batchId: BATCH, createdAt: now.minus({ hours: 1 }) })
    await rfqOf(org, { title: 'Panier B', batchId: BATCH, createdAt: now.minus({ hours: 1 }) })

    const response = await list(client, owner)

    response.assertStatus(200)
    response.assertInertiaComponent('rfqs/index')
    const groups = response.inertiaProps.groups as RfqBatchGroupType[]
    assert.lengthOf(groups, 2)
    assert.equal(groups[0].batchId, BATCH)
    assert.sameMembers(
      groups[0].rfqs.map(({ title }) => title),
      ['Panier A', 'Panier B']
    )
    assert.isNull(groups[1].batchId)
    assert.deepEqual(
      groups[1].rfqs.map(({ title }) => title),
      ['Seule']
    )
  })

  test('tous les membres voient toutes les demandes de l’agence', async ({ client, assert }) => {
    const { org, owner, member } = await agency()
    await rfqOf(org, { title: 'De Olivia', author: owner })
    await rfqOf(await OrganizationFactory.create(), { title: 'Chez le voisin' })

    const response = await list(client, member)

    response.assertStatus(200)
    assert.deepEqual(titlesOf(response.inertiaProps.groups as RfqBatchGroupType[]), ['De Olivia'])
  })

  test('les filtres de l’URL s’appliquent et reviennent à la page', async ({ client, assert }) => {
    const { org, owner, member, supplier } = await agency()
    const answered = await rfqOf(org, { title: 'Répondue de Mia', author: member })
    await recipientOf(answered, supplier, 'responded')
    await rfqOf(org, { title: 'Envoyée de Mia', author: member })
    const ownerAnswered = await rfqOf(org, { title: 'Répondue d’Olivia', author: owner })
    await recipientOf(ownerAnswered, supplier, 'responded')

    const response = await list(client, owner, `?status=responded&authorId=${member.id}`)

    response.assertStatus(200)
    assert.deepEqual(titlesOf(response.inertiaProps.groups as RfqBatchGroupType[]), [
      'Répondue de Mia',
    ])
    assert.deepEqual(response.inertiaProps.filters, { status: 'responded', authorId: member.id })
    assert.sameMembers(
      (response.inertiaProps.authors as Array<{ id: number }>).map(({ id }) => id),
      [owner.id, member.id]
    )
  })

  test('un filtre invalide est ignoré sans faire tomber l’autre', async ({ client, assert }) => {
    const { org, owner, supplier } = await agency()
    const answered = await rfqOf(org, { title: 'Répondue' })
    await recipientOf(answered, supplier, 'responded')
    await rfqOf(org, { title: 'Brouillon', status: 'draft' })

    const response = await list(client, owner, '?status=responded&authorId=abc')

    response.assertStatus(200)
    assert.deepEqual(titlesOf(response.inertiaProps.groups as RfqBatchGroupType[]), ['Répondue'])
    assert.deepEqual(response.inertiaProps.filters, { status: 'responded', authorId: null })
  })

  test('des filtres tous invalides : la liste s’affiche entière', async ({ client, assert }) => {
    const { org, owner } = await agency()
    await rfqOf(org, { title: 'Tote bags' })

    const response = await list(client, owner, '?status=bogus&authorId=abc')

    response.assertStatus(200)
    assert.lengthOf(response.inertiaProps.groups as RfqBatchGroupType[], 1)
    assert.deepEqual(response.inertiaProps.filters, { status: null, authorId: null })
  })

  test('la ligne porte l’avancement lisible et l’indicateur « devis reçu »', async ({
    client,
    assert,
  }) => {
    const { org, owner, supplier } = await agency()
    const rfq = await rfqOf(org, { title: 'Tote bags', author: owner })
    const recipient = await recipientOf(rfq, supplier, 'responded')
    await receivedQuoteDocument(rfq, recipient)

    const response = await list(client, owner)

    const [row] = (response.inertiaProps.groups as RfqBatchGroupType[])[0].rfqs
    assert.equal(row.progress, 'responded')
    assert.isTrue(row.hasReceivedQuote)
    assert.equal(row.createdByName, 'Olivia Owner')
  })

  test('une organisation fournisseuse n’a pas accès à « Mes demandes » (403)', async ({
    client,
  }) => {
    const { supplier } = await agency()
    const supplierOwner = await createMember(supplier, 'owner')

    const response = await client.get('/fr/rfqs').loginAs(supplierOwner)

    response.assertStatus(403)
  })

  test('le détail liste les devis PDF à côté des devis structurés', async ({ client, assert }) => {
    const { org, member, supplier } = await agency()
    const rfq = await rfqOf(org, { title: 'Tote bags' })
    const recipient = await recipientOf(rfq, supplier, 'responded')
    const document = await receivedQuoteDocument(rfq, recipient, { filename: 'devis.pdf' })
    await QuoteFactory.apply('submitted')
      .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id, totalAmount: '120.00' })
      .create()

    const response = await client.get(`/fr/rfqs/${rfq.id}`).withInertia().loginAs(member)

    response.assertStatus(200)
    assert.lengthOf(response.inertiaProps.quotes as unknown[], 1)
    const [listed] = response.inertiaProps.quoteDocuments as QuoteDocumentType[]
    assert.lengthOf(response.inertiaProps.quoteDocuments as unknown[], 1)
    assert.containsSubset(listed, {
      id: document.id,
      rfqSupplierId: recipient.id,
      supplierName: 'Textiles du Nord',
      filename: 'devis.pdf',
      selectedAt: null,
    })
    assert.equal(DateTime.fromISO(listed.receivedAt).toMillis(), document.receivedAt.toMillis())
  })

  test('le détail d’une demande d’une autre agence est introuvable (404)', async ({ client }) => {
    const { owner } = await agency()
    const foreign = await rfqOf(await OrganizationFactory.create(), { title: 'Ailleurs' })

    const response = await client.get(`/fr/rfqs/${foreign.id}`).loginAs(owner)

    response.assertStatus(404)
  })
})

test.group('Mes demandes — devis PDF « retenu » (#228)', (group) => {
  useDatabase(group)

  async function scenario() {
    const actors = await agency()
    const rfq = await rfqOf(actors.org, { title: 'Tote bags' })
    const recipient = await recipientOf(rfq, actors.supplier, 'responded')
    const document = await receivedQuoteDocument(rfq, recipient)
    return { ...actors, rfq, document }
  }

  function select(client: ApiClient, document: QuoteDocument, user: User) {
    return client
      .post(`/fr/quote-documents/${document.id}/select`)
      .withCsrfToken()
      .header('referer', '/fr/rfqs')
      .redirects(0)
      .loginAs(user)
  }

  /**
   * Refus Bouncer sur une action : l'utilisateur est renvoyé d'où il vient
   * avec un message (comme pour la clôture, `rfq_screens.spec.ts`), le succès
   * n'est jamais annoncé.
   */
  function assertRefused(response: Awaited<ReturnType<typeof select>>) {
    response.assertStatus(302)
    response.assertFlashMissing('success')
  }

  test('un manager retient le devis : la demande est clôturée, sans commande', async ({
    client,
    assert,
  }) => {
    const { manager, rfq, document } = await scenario()

    const response = await select(client, document, manager)

    response.assertStatus(302)
    response.assertHeader('location', '/fr/rfqs')
    await rfq.refresh()
    await document.refresh()
    assert.equal(rfq.status, 'closed')
    assert.isNotNull(document.selectedAt)
    const [{ total }] = await db.from('orders').count('* as total')
    assert.equal(Number(total), 0)
  })

  test('le propriétaire retient aussi', async ({ client, assert }) => {
    const { owner, document } = await scenario()

    const response = await select(client, document, owner)

    response.assertStatus(302)
    await document.refresh()
    assert.isNotNull(document.selectedAt)
  })

  test('un membre simple ne retient pas, la demande reste ouverte', async ({ client, assert }) => {
    const { member, rfq, document } = await scenario()

    const response = await select(client, document, member)

    assertRefused(response)
    await rfq.refresh()
    await document.refresh()
    assert.equal(rfq.status, 'published')
    assert.isNull(document.selectedAt)
  })

  test('le responsable d’une autre agence est refusé', async ({ client, assert }) => {
    const { document } = await scenario()
    const outsider = await createMember(await OrganizationFactory.create(), 'owner')

    const response = await select(client, document, outsider)

    assertRefused(response)
    await document.refresh()
    assert.isNull(document.selectedAt)
  })

  test('le fournisseur lui-même est refusé', async ({ client, assert }) => {
    const { supplier, document } = await scenario()
    const supplierOwner = await createMember(supplier, 'owner')

    const response = await select(client, document, supplierOwner)

    assertRefused(response)
    await document.refresh()
    assert.isNull(document.selectedAt)
  })

  test('une demande déjà close : message d’erreur, rien n’est marqué', async ({
    client,
    assert,
  }) => {
    const { manager, rfq, document } = await scenario()
    await rfq.merge({ status: 'closed', closedAt: DateTime.now() }).save()

    const response = await select(client, document, manager)

    response.assertStatus(302)
    response.assertFlashMessage(
      'error',
      'Cette demande n’est plus ouverte : impossible de retenir ce devis.'
    )
    await document.refresh()
    assert.isNull(document.selectedAt)
  })

  test('un devis inconnu est un 404', async ({ client }) => {
    const { manager } = await scenario()

    const response = await client
      .post('/fr/quote-documents/999999/select')
      .withCsrfToken()
      .redirects(0)
      .loginAs(manager)

    response.assertStatus(404)
  })
})
