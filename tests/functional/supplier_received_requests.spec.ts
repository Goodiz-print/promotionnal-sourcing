import { test } from '@japa/runner'
import type { ApiClient, ApiResponse } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqItemFactory } from '#database/factories/rfq_item_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import { InvalidDocumentException } from '#exceptions/document_errors'
import { QuoteDocumentNotFoundException } from '#exceptions/quote_errors'
import { RfqSupplierNotReplyableException } from '#exceptions/rfq_errors'
import SupplierReplyReceivedNotification from '#mails/supplier_reply_received_notification'
import Conversation from '#models/conversation'
import Message from '#models/message'
import Organization from '#models/organization'
import QuoteDocument from '#models/quote_document'
import RfqSupplier from '#models/rfq_supplier'
import StorageObject from '#models/storage_object'
import type User from '#models/user'
import QuoteService from '#services/quote_service'
import RfqRecipientService from '#services/rfq_recipient_service'
import RfqService from '#services/rfq_service'
import SupplierReplyService from '#services/supplier_reply_service'
import { deliver, sentRfq, useFakeInboundMail } from '#tests/utils/inbound_mail'
import { createMember, subscribeOrganization } from '#tests/utils/organizations'
import { realPdf, useFakeGhostscript } from '#tests/utils/pdf'
import { receivedQuoteDocument } from '#tests/utils/quote_documents'
import { useDatabase } from '#tests/utils/setup'
import { uploadedFile, useFakeStorage } from '#tests/utils/storage'
import type { RfqSupplierStatus } from '#shared/types/rfq'

/** `QuoteService` dont l'enregistrement des devis PDF échoue en pleine transaction. */
class FailingQuoteService extends QuoteService {
  recordDocuments(): never {
    throw new Error('écriture du devis impossible')
  }
}

interface ReceivedRfqOptions {
  buyer: Organization
  supplier: Organization
  status: RfqSupplierStatus
  lateReplyAt?: DateTime
}

/** Demande publiée reçue par `supplier` avec le statut de destinataire donné. */
async function receivedRfq({ buyer, supplier, status, lateReplyAt }: ReceivedRfqOptions) {
  const rfq = await RfqFactory.merge({
    buyerOrganizationId: buyer.id,
    title: `Demande ${status}`,
    status: 'published',
    publishedAt: DateTime.now(),
  }).create()
  await RfqItemFactory.merge({ rfqId: rfq.id }).createMany(2)
  const recipient = await RfqSupplierFactory.merge({
    rfqId: rfq.id,
    supplierOrganizationId: supplier.id,
    status,
    sentAt: status === 'pending' ? null : DateTime.now(),
    lateReplyAt: lateReplyAt ?? null,
  }).create()
  return { rfq, recipient }
}

/** Fournisseur (owner qui répond aux demandes) et agence qui le consulte. */
async function supplierScenario() {
  const supplier = await OrganizationFactory.apply('supplier').create()
  const owner = await createMember(supplier, 'owner')
  const buyer = await OrganizationFactory.merge({ name: 'Agence Lumière' }).create()
  return { supplier, owner, buyer }
}

/** Demande envoyée (adresse relais valide) avec un responsable de l'agence et un owner fournisseur. */
async function uploadScenario(rfqState: 'published' | 'expired' = 'published') {
  const sent = await sentRfq(rfqState)
  const buyer = await Organization.findOrFail(sent.rfq.buyerOrganizationId)
  const agencyOwner = await createMember(buyer, 'owner', { email: 'owner@agence.test' })
  const owner = await createMember(sent.supplier, 'owner')
  return { ...sent, buyer, agencyOwner, owner }
}

/**
 * Dépôt du PDF comme le formulaire Inertia l'envoie. `asJson` : même requête
 * attendant du JSON, pour qu'un refus d'autorisation garde son statut 403 (une
 * visite Inertia est redirigée).
 */
async function uploadPdf(
  client: ApiClient,
  { rfqId, user, content, asJson = false }: UploadRequest
) {
  const file = await uploadedFile(content ?? (await realPdf()), 'pdf')
  const request = client
    .post(`/fr/supplier/rfqs/${rfqId}/quote-documents`)
    .redirects(0)
    .withCsrfToken()
    .loginAs(user)
    .header('referer', `/fr/supplier/rfqs/${rfqId}`)
    .field('body', 'Voici notre devis.')
    .file('file', file.tmpPath!, { contentType: 'application/pdf' })
  return asJson ? request.header('Accept', 'application/json') : request.withInertia()
}

interface UploadRequest {
  rfqId: number
  user: User
  content?: Buffer
  asJson?: boolean
}

/** Statut de la réponse à une requête. */
async function expectStatus(request: PromiseLike<ApiResponse>, status: number): Promise<void> {
  const response = await request
  response.assertStatus(status)
}

function sentReplyRecipients(mails: ReturnType<typeof mail.fake>['mails']): string[] {
  return mails
    .sent((mailer) => mailer instanceof SupplierReplyReceivedNotification)
    .map((mailer) => (mailer as unknown as { email: string }).email)
}

test.group('Demandes reçues — statuts et filtres (#230)', (group) => {
  useDatabase(group)

  test('chaque demande porte son statut lisible : à traiter, répondu, expiré, décliné', async ({
    client,
    assert,
  }) => {
    const { supplier, owner, buyer } = await supplierScenario()
    await subscribeOrganization(supplier)
    await receivedRfq({ buyer, supplier, status: 'sent' })
    await receivedRfq({ buyer, supplier, status: 'viewed' })
    await receivedRfq({ buyer, supplier, status: 'responded', lateReplyAt: DateTime.now() })
    await receivedRfq({ buyer, supplier, status: 'expired' })
    await receivedRfq({ buyer, supplier, status: 'declined' })

    const response = await client.get('/fr/supplier/rfqs').withInertia().loginAs(owner)

    response.assertStatus(200)
    const rows = response.inertiaProps.rfqs as Array<Record<string, unknown>>
    const states = Object.fromEntries(rows.map((row) => [row.myStatus, row.myState]))
    assert.deepEqual(states, {
      sent: 'to_process',
      viewed: 'to_process',
      responded: 'responded',
      expired: 'expired',
      declined: 'declined',
    })
    assert.isTrue(rows.find((row) => row.myStatus === 'responded')!.myLateReply as boolean)
    assert.equal(rows[0].itemCount, 2)
    assert.deepEqual(response.inertiaProps.filters, { status: null })
  })

  test('le filtre par statut, porté par l’URL, ne garde que les demandes concernées', async ({
    client,
    assert,
  }) => {
    const { supplier, owner, buyer } = await supplierScenario()
    await receivedRfq({ buyer, supplier, status: 'sent' })
    await receivedRfq({ buyer, supplier, status: 'viewed' })
    await receivedRfq({ buyer, supplier, status: 'expired' })

    const toProcess = await client
      .get('/fr/supplier/rfqs?status=to_process')
      .withInertia()
      .loginAs(owner)
    assert.lengthOf(toProcess.inertiaProps.rfqs, 2)
    assert.deepEqual(toProcess.inertiaProps.filters, { status: 'to_process' })

    const expired = await client
      .get('/fr/supplier/rfqs?status=expired')
      .withInertia()
      .loginAs(owner)
    assert.deepEqual(
      expired.inertiaProps.rfqs.map((rfq: { myState: string }) => rfq.myState),
      ['expired']
    )
  })

  test('un filtre invalide est ignoré plutôt que refusé', async ({ client, assert }) => {
    const { supplier, owner, buyer } = await supplierScenario()
    await receivedRfq({ buyer, supplier, status: 'sent' })
    await receivedRfq({ buyer, supplier, status: 'declined' })

    const response = await client
      .get('/fr/supplier/rfqs?status=pending')
      .withInertia()
      .loginAs(owner)

    response.assertStatus(200)
    assert.lengthOf(response.inertiaProps.rfqs, 2)
    assert.deepEqual(response.inertiaProps.filters, { status: null })
  })

  test('le filtre garde l’agence masquée pour un fournisseur non abonné (#220)', async ({
    client,
    assert,
  }) => {
    const { supplier, owner, buyer } = await supplierScenario()
    await receivedRfq({ buyer, supplier, status: 'sent' })

    const response = await client
      .get('/fr/supplier/rfqs?status=to_process')
      .withInertia()
      .loginAs(owner)

    assert.lengthOf(response.inertiaProps.rfqs, 1)
    assert.isNull(response.inertiaProps.rfqs[0].buyerName)
    assert.notInclude(JSON.stringify(response.inertiaProps.rfqs), 'Agence Lumière')
  })

  test('RfqService#listForSupplier : ni demande non envoyée, ni demande d’un autre fournisseur', async ({
    assert,
  }) => {
    const { supplier, buyer } = await supplierScenario()
    const other = await OrganizationFactory.apply('supplier').create()
    await receivedRfq({ buyer, supplier, status: 'pending' })
    const { rfq: mine } = await receivedRfq({ buyer, supplier, status: 'responded' })
    await receivedRfq({ buyer, supplier: other, status: 'responded' })
    const service = await app.container.make(RfqService)

    const all = await service.listForSupplier(supplier.id)
    const responded = await service.listForSupplier(supplier.id, { status: 'responded' })
    const declined = await service.listForSupplier(supplier.id, { status: 'declined' })

    assert.deepEqual(
      all.map((rfq) => rfq.id),
      [mine.id]
    )
    assert.deepEqual(
      responded.map((rfq) => rfq.id),
      [mine.id]
    )
    assert.lengthOf(declined, 0)
    // Seule la ligne du fournisseur est chargée, et les items sont comptés.
    assert.lengthOf(all[0].suppliers, 1)
    assert.equal(Number(all[0].$extras.itemsCount), 2)
  })
})

test.group('Demandes reçues — devis envoyé par mail (#230)', (group) => {
  useDatabase(group)
  const inbound = useFakeInboundMail(group)
  useFakeStorage(group)
  useFakeGhostscript(group, { available: false })
  group.each.setup(() => {
    mail.fake()
    return () => mail.restore()
  })

  test('un fournisseur qui a répondu par mail retrouve sa demande « répondu » avec son PDF d’origine', async ({
    client,
    assert,
  }) => {
    const { rfq, supplier, address } = await sentRfq()
    const owner = await createMember(supplier, 'owner')
    const original = await realPdf()
    inbound.provider.add('mail-1', {
      to: address,
      attachments: [{ filename: 'devis.pdf', content: original }],
    })
    await expectStatus(deliver(client, 'mail-1'), 200)

    const list = await client.get('/fr/supplier/rfqs?status=responded').withInertia().loginAs(owner)
    assert.deepEqual(
      list.inertiaProps.rfqs.map((row: { id: number }) => row.id),
      [rfq.id]
    )

    const show = await client.get(`/fr/supplier/rfqs/${rfq.id}`).withInertia().loginAs(owner)
    assert.equal(show.inertiaProps.rfq.myState, 'responded')
    const [document] = show.inertiaProps.documents
    assert.equal(document.filename, 'devis.pdf')
    assert.isTrue(document.viaMail)

    // Non abonné : une copie au nom de l'agence existe (#238), mais il reçoit l'original.
    const stored = await QuoteDocument.findOrFail(document.id)
    assert.isNotNull(stored.recipientStorageObjectId)
    const download = await client
      .get(`/fr/supplier/quote-documents/${document.id}/download`)
      .loginAs(owner)
    download.assertStatus(200)
    download.assertHeader('content-type', 'application/pdf')
    download.assertHeader('cache-control', 'private, no-store')
    const kept = await StorageObject.findOrFail(stored.recipientStorageObjectId!)
    assert.equal(Number(download.header('content-length')), original.length)
    assert.notEqual(kept.size, original.length)
  })

  test('le téléchargement est réservé au fournisseur destinataire', async ({ client }) => {
    const { rfq, supplier, recipient } = await sentRfq()
    const document = await receivedQuoteDocument(rfq, recipient)
    const memberOnly = await createMember(supplier, 'member')
    const otherSupplier = await OrganizationFactory.apply('supplier').create()
    const stranger = await createMember(otherSupplier, 'owner')
    const agency = await Organization.findOrFail(rfq.buyerOrganizationId)
    const agencyOwner = await createMember(agency, 'owner')
    const path = `/fr/supplier/quote-documents/${document.id}/download`

    await expectStatus(client.get(path).loginAs(stranger), 403)
    await expectStatus(client.get(path).loginAs(memberOnly), 403)
    // L'agence passe par sa propre route (version à son nom), pas par celle-ci.
    await expectStatus(client.get(path).loginAs(agencyOwner), 403)
    const unknown = `/fr/supplier/quote-documents/${document.id + 99}/download`
    await expectStatus(client.get(unknown).loginAs(stranger), 404)
  })

  test('QuoteService#documentsSentBy : les devis du destinataire, le plus récent en tête', async ({
    assert,
  }) => {
    const { rfq, recipient } = await sentRfq()
    const otherSupplier = await OrganizationFactory.apply('supplier').create()
    const other = await RfqSupplierFactory.apply('sent')
      .merge({ rfqId: rfq.id, supplierOrganizationId: otherSupplier.id })
      .create()
    const older = await receivedQuoteDocument(rfq, recipient, {
      filename: 'v1.pdf',
      receivedAt: DateTime.now().minus({ days: 2 }),
    })
    const newer = await receivedQuoteDocument(rfq, recipient, { filename: 'v2.pdf' })
    await receivedQuoteDocument(rfq, other, { filename: 'concurrent.pdf' })
    const quotes = await app.container.make(QuoteService)

    const documents = await quotes.documentsSentBy(recipient.id)

    assert.deepEqual(
      documents.map((document) => document.id),
      [newer.id, older.id]
    )
    assert.equal(documents[0].attachment.filename, 'v2.pdf')
    assert.isNull(documents[0].message.inboundMailId)
  })

  test('QuoteService#findDocumentForSupplier : destinataire et fichier d’origine, ou 404', async ({
    assert,
  }) => {
    const { rfq, recipient, supplier } = await sentRfq()
    const document = await receivedQuoteDocument(rfq, recipient)
    const quotes = await app.container.make(QuoteService)

    const found = await quotes.findDocumentForSupplier(document.id)

    assert.equal(found.rfqSupplier.supplierOrganizationId, supplier.id)
    assert.equal(found.attachment.storageObject.mimeType, 'application/pdf')
    await assert.rejects(
      () => quotes.findDocumentForSupplier(document.id + 99),
      QuoteDocumentNotFoundException
    )
  })
})

test.group('Demandes reçues — dépôt du devis PDF depuis l’écran (#230)', (group) => {
  useDatabase(group)
  useFakeStorage(group)
  useFakeGhostscript(group, { available: false })
  let mails: ReturnType<typeof mail.fake>['mails']
  group.each.setup(() => {
    mails = mail.fake().mails
    return () => mail.restore()
  })

  test('un PDF déposé suit le traitement d’un PDF reçu par mail : devis, statut, transmission', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, owner } = await uploadScenario()

    const response = await uploadPdf(client, { rfqId: rfq.id, user: owner })

    response.assertStatus(302)
    response.assertFlashMessage('success', "Devis envoyé : l'agence en est informée.")
    const [document] = await QuoteDocument.query().where('rfqSupplierId', recipient.id)
    assert.exists(document)
    // Non abonné : la copie au nom de l'agence est faite, comme pour un mail (#238).
    assert.isNotNull(document.recipientStorageObjectId)
    assert.isNotNull(document.stampedAt)

    const message = await Message.query().where('id', document.messageId).firstOrFail()
    assert.equal(message.authorUserId, owner.id)
    assert.isNull(message.inboundMailId)
    assert.equal(message.senderSide, 'supplier')
    assert.equal(message.body, 'Voici notre devis.')

    await recipient.refresh()
    assert.equal(recipient.status, 'responded')
    assert.isNull(recipient.lateReplyAt)
    // Transmis à l'agence (#225), comme une réponse par mail.
    assert.deepEqual(sentReplyRecipients(mails), ['owner@agence.test'])

    const show = await client.get(`/fr/supplier/rfqs/${rfq.id}`).withInertia().loginAs(owner)
    assert.isFalse(show.inertiaProps.documents[0].viaMail)
  })

  test('le PDF d’un fournisseur abonné n’est pas modifié', async ({ client, assert }) => {
    const { rfq, supplier, owner } = await uploadScenario()
    await subscribeOrganization(supplier)

    await uploadPdf(client, { rfqId: rfq.id, user: owner })

    const document = await QuoteDocument.firstOrFail()
    assert.isNull(document.recipientStorageObjectId)
  })

  test('après l’échéance, le dépôt est accepté et marqué tardif (#232)', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, owner } = await uploadScenario('expired')
    await recipient.merge({ status: 'expired', expiredFrom: 'viewed' }).save()

    const response = await uploadPdf(client, { rfqId: rfq.id, user: owner })

    response.assertStatus(302)
    await recipient.refresh()
    assert.equal(recipient.status, 'responded')
    assert.isNotNull(recipient.lateReplyAt)
  })

  test('l’écran propose le dépôt tant que la demande accepte des réponses', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, owner } = await uploadScenario()

    const open = await client.get(`/fr/supplier/rfqs/${rfq.id}`).withInertia().loginAs(owner)
    assert.isTrue(open.inertiaProps.canUploadQuote)
    assert.deepEqual(open.inertiaProps.documents, [])

    await recipient.merge({ status: 'declined' }).save()
    const declined = await client.get(`/fr/supplier/rfqs/${rfq.id}`).withInertia().loginAs(owner)
    assert.isFalse(declined.inertiaProps.canUploadQuote)
  })

  test('une demande clôturée ne propose plus le dépôt et la route le refuse (#290)', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, owner } = await uploadScenario()
    // Clôturée hier : l'adresse relais est encore valide, seul le statut refuse.
    await rfq.merge({ status: 'closed', closedAt: DateTime.now().minus({ days: 1 }) }).save()

    const page = await client.get(`/fr/supplier/rfqs/${rfq.id}`).withInertia().loginAs(owner)
    assert.isFalse(page.inertiaProps.canUploadQuote)
    await expectStatus(uploadPdf(client, { rfqId: rfq.id, user: owner, asJson: true }), 403)

    assert.lengthOf(await QuoteDocument.all(), 0)
    await recipient.refresh()
    // L'ouverture de l'écran l'a marquée lue, le dépôt refusé ne l'a pas fait « répondu ».
    assert.equal(recipient.status, 'viewed')
  })

  test('un fichier qui n’est pas un PDF est refusé sans rien enregistrer', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, owner } = await uploadScenario()

    const spoofed = await uploadPdf(client, {
      rfqId: rfq.id,
      user: owner,
      content: Buffer.from('<html>pas un pdf</html>'),
    })
    // Contenu examiné dès la validation : un « .pdf » qui n'en est pas un est refusé.
    spoofed.assertStatus(302)
    assert.property(spoofed.flashMessages().inputErrorsBag, 'file')

    assert.lengthOf(await QuoteDocument.all(), 0)
    assert.lengthOf(await StorageObject.query().where('status', 'ready'), 0)
    await recipient.refresh()
    assert.equal(recipient.status, 'sent')
  })

  test('le dépôt est refusé à un simple membre, après un refus, et à une autre organisation', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, supplier, owner, agencyOwner } = await uploadScenario()
    const member = await createMember(supplier, 'member')
    const otherSupplier = await OrganizationFactory.apply('supplier').create()
    const stranger = await createMember(otherSupplier, 'owner')

    await expectStatus(uploadPdf(client, { rfqId: rfq.id, user: member, asJson: true }), 403)
    await expectStatus(uploadPdf(client, { rfqId: rfq.id, user: stranger }), 404)
    await expectStatus(uploadPdf(client, { rfqId: rfq.id, user: agencyOwner }), 404)

    await recipient.merge({ status: 'declined' }).save()
    await expectStatus(uploadPdf(client, { rfqId: rfq.id, user: owner, asJson: true }), 403)

    assert.lengthOf(await QuoteDocument.all(), 0)
  })

  test('un fil bloqué par la plateforme refuse le dépôt et ne garde aucun fichier', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, owner } = await uploadScenario()
    await Conversation.create({
      buyerOrganizationId: rfq.buyerOrganizationId,
      supplierOrganizationId: recipient.supplierOrganizationId,
      rfqId: rfq.id,
      rfqSupplierId: recipient.id,
      subject: rfq.title,
      createdByUserId: null,
      blockedAt: DateTime.now(),
    })

    const response = await uploadPdf(client, { rfqId: rfq.id, user: owner })

    // Erreur du champ `file`, comme une erreur de validation : le formulaire garde sa saisie.
    response.assertStatus(302)
    assert.notProperty(response.flashMessages(), 'error')
    const fieldErrors = response.flashMessages().errorsBag as Record<string, string>
    assert.equal(
      fieldErrors.file,
      'Ce fil est bloqué par la plateforme : vous ne pouvez plus y écrire.'
    )
    assert.lengthOf(await QuoteDocument.all(), 0)
    assert.lengthOf(await StorageObject.query().where('status', 'ready'), 0)
  })

  test('SupplierReplyService#recordUpload : un refus arrivé depuis l’ability l’emporte, sous verrou', async ({
    assert,
  }) => {
    const { recipient, owner } = await uploadScenario()
    await recipient.load('rfq')
    // L'ability a vu la demande ouverte ; le fournisseur décline juste avant l'écriture.
    await RfqSupplier.query().where('id', recipient.id).update({ status: 'declined' })
    const file = await uploadedFile(await realPdf(), 'pdf')
    const replies = await app.container.make(SupplierReplyService)

    await assert.rejects(
      () =>
        replies.recordUpload(recipient, owner, {
          tmpPath: file.tmpPath!,
          filename: 'devis.pdf',
          body: '',
        }),
      RfqSupplierNotReplyableException
    )
    assert.lengthOf(await QuoteDocument.all(), 0)
    assert.lengthOf(await Message.all(), 0)
    assert.lengthOf(await StorageObject.query().where('status', 'ready'), 0)
    const reloaded = await RfqSupplier.findOrFail(recipient.id)
    assert.equal(reloaded.status, 'declined')
  })

  test('SupplierReplyService#recordUpload : un contenu sans en-tête PDF est refusé, rien n’est stocké', async ({
    assert,
  }) => {
    const { recipient, owner } = await uploadScenario()
    await recipient.load('rfq')
    const file = await uploadedFile(Buffer.from('<html>pas un pdf</html>'), 'pdf')
    const replies = await app.container.make(SupplierReplyService)

    await assert.rejects(
      () =>
        replies.recordUpload(recipient, owner, {
          tmpPath: file.tmpPath!,
          filename: 'devis.pdf',
          body: '',
        }),
      InvalidDocumentException
    )
    assert.lengthOf(await StorageObject.all(), 0)
    assert.lengthOf(await Message.all(), 0)
  })

  test('SupplierReplyService#recordUpload : un échec en pleine transaction ne laisse aucun fichier', async ({
    assert,
  }) => {
    const { recipient, owner } = await uploadScenario()
    await recipient.load('rfq')
    const file = await uploadedFile(await realPdf(), 'pdf')
    app.container.swap(
      QuoteService,
      async (resolver) =>
        new FailingQuoteService(
          await resolver.make(RfqService),
          await resolver.make(RfqRecipientService)
        )
    )
    const replies = await app.container.make(SupplierReplyService)

    await assert.rejects(
      () =>
        replies.recordUpload(recipient, owner, {
          tmpPath: file.tmpPath!,
          filename: 'devis.pdf',
          body: '',
        }),
      'écriture du devis impossible'
    )

    assert.lengthOf(await Message.all(), 0)
    assert.lengthOf(await StorageObject.query().where('status', 'ready'), 0)
    const unchanged = await RfqSupplier.findOrFail(recipient.id)
    assert.equal(unchanged.status, 'sent')
  }).cleanup(() => app.container.restore(QuoteService))
})
