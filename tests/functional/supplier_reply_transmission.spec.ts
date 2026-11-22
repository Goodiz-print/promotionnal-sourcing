import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import emitter from '@adonisjs/core/services/emitter'
import inboundMailConfig from '#config/inbound_mail'
import { QuoteDocumentNotFoundException } from '#exceptions/quote_errors'
import mail from '@adonisjs/mail/services/main'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import SupplierReplyRecorded from '#events/supplier_reply_recorded'
import SupplierReplyReceivedNotification from '#mails/supplier_reply_received_notification'
import Message from '#models/message'
import Notification from '#models/notification'
import QuoteDocument from '#models/quote_document'
import RfqSupplier from '#models/rfq_supplier'
import Organization from '#models/organization'
import type User from '#models/user'
import InAppNotificationService from '#services/in_app_notification_service'
import NotificationService from '#services/notification_service'
import InboundAddressService from '#services/inbound_address_service'
import QuoteService from '#services/quote_service'
import SupplierReplyNotificationService from '#services/supplier_reply_notification_service'
import { deliver, sentRfq, TEST_RELAY_DOMAIN, useFakeInboundMail } from '#tests/utils/inbound_mail'
import { createMember, subscribeOrganization } from '#tests/utils/organizations'
import { realPdf, useFakeGhostscript } from '#tests/utils/pdf'
import { useDatabase } from '#tests/utils/setup'
import { useFakeStorage } from '#tests/utils/storage'
import type { SupplierReplyReceivedMailData } from '#shared/types/mail'
import type { SupplierReplyRecordedData } from '#shared/types/supplier_reply'

/** Mail transmis, tel que la classe de mail l'a reçu (destinataire et données). */
interface SentReply {
  to: string
  data: SupplierReplyReceivedMailData
  replyTo: string[]
}

let mails: ReturnType<typeof mail.fake>['mails']

function sentReplies(): SentReply[] {
  return mails
    .sent((mailer) => mailer instanceof SupplierReplyReceivedNotification)
    .map((mailer) => {
      const fields = mailer as unknown as { email: string; data: SupplierReplyReceivedMailData }
      const { message } = (mailer as SupplierReplyReceivedNotification).message.toJSON()
      return { to: fields.email, data: fields.data, replyTo: (message.replyTo ?? []) as string[] }
    })
}

/**
 * Agence avec son auteur (simple membre), un propriétaire, un manager et un
 * membre qui n'a pas écrit la demande ; demande envoyée à un fournisseur.
 */
async function agencyScenario() {
  const sent = await sentRfq()
  const buyer = await Organization.findOrFail(sent.rfq.buyerOrganizationId)
  const author = await createMember(buyer, 'member', { email: 'auteur@agence.test' })
  const owner = await createMember(buyer, 'owner', { email: 'owner@agence.test' })
  const manager = await createMember(buyer, 'manager', { email: 'manager@agence.test' })
  const bystander = await createMember(buyer, 'member', { email: 'membre@agence.test' })
  await sent.rfq.merge({ createdByUserId: author.id }).save()
  return { ...sent, buyer, author, owner, manager, bystander }
}

/** Le fournisseur répond par mail avec un devis PDF. */
async function replyWithPdf(
  client: ApiClient,
  inbound: ReturnType<typeof useFakeInboundMail>,
  { address, text = 'Bonjour, voici notre devis.' }: { address: string; text?: string }
) {
  inbound.provider.add('mail-1', {
    to: address,
    text,
    attachments: [{ filename: 'devis été.pdf', content: await realPdf() }],
  })
  const response = await deliver(client, 'mail-1')
  response.assertStatus(200)
}

/** Ce que l'événement a annoncé, reconstitué depuis la base, pour le rejouer. */
async function recordedReply(): Promise<SupplierReplyRecordedData> {
  const message = await Message.query().whereNotNull('inboundMailId').firstOrFail()
  const documents = await QuoteDocument.query().where('messageId', message.id)
  return {
    inboundMailId: message.inboundMailId!,
    rfqSupplierId: documents[0].rfqSupplierId,
    conversationId: message.conversationId,
    messageId: message.id,
    quoteDocumentIds: documents.map((document) => document.id),
    responded: true,
    late: false,
  }
}

function download(client: ApiClient, path: string, user?: User) {
  const request = client.get(path).redirects(0)
  return user ? request.loginAs(user) : request
}

test.group('Réponse par mail — transmission à l’agence (#225)', (group) => {
  useDatabase(group)
  const inbound = useFakeInboundMail(group)
  useFakeStorage(group)
  useFakeGhostscript(group, { available: false })
  group.each.setup(() => {
    mails = mail.fake().mails
    return () => mail.restore()
  })

  test('l’auteur et les responsables reçoivent la réponse, pas les autres membres ni le fournisseur', async ({
    client,
    assert,
  }) => {
    const { address } = await agencyScenario()

    await replyWithPdf(client, inbound, { address })

    const recipients = sentReplies()
      .map(({ to }) => to)
      .sort()
    assert.deepEqual(recipients, ['auteur@agence.test', 'manager@agence.test', 'owner@agence.test'])
    assert.notInclude(recipients, 'contact@fournisseur.test')
  })

  test('un auteur qui est aussi responsable ne reçoit qu’un mail et une notification', async ({
    client,
    assert,
  }) => {
    const { rfq, owner, address } = await agencyScenario()
    await rfq.merge({ createdByUserId: owner.id }).save()

    await replyWithPdf(client, inbound, { address })

    const toOwner = sentReplies().filter(({ to }) => to === 'owner@agence.test')
    assert.lengthOf(toOwner, 1)
    assert.lengthOf(await Notification.query().where('userId', owner.id), 1)
  })

  test('un auteur qui a quitté l’agence n’est plus prévenu', async ({ client, assert }) => {
    const { rfq, address } = await agencyScenario()
    const elsewhere = await OrganizationFactory.create()
    const former = await createMember(elsewhere, 'owner', { email: 'parti@ailleurs.test' })
    await rfq.merge({ createdByUserId: former.id }).save()

    await replyWithPdf(client, inbound, { address })

    assert.notInclude(
      sentReplies().map(({ to }) => to),
      'parti@ailleurs.test'
    )
    // Les responsables, eux, sont toujours prévenus.
    assert.lengthOf(sentReplies(), 2)
  })

  test('un événement rejoué ne renvoie ni mail ni notification', async ({ client, assert }) => {
    const { address } = await agencyScenario()
    await replyWithPdf(client, inbound, { address })
    const firstMails = sentReplies().length
    const notificationsBefore = await Notification.all()

    const reply = await recordedReply()
    await emitter.emit(SupplierReplyRecorded, new SupplierReplyRecorded(reply))

    assert.equal(firstMails, 3)
    assert.equal(sentReplies().length, firstMails)
    assert.lengthOf(await Notification.all(), notificationsBefore.length)
  })

  test('le mail nomme le fournisseur, reprend son texte et le Reply-To relais côté agence', async ({
    client,
    assert,
  }) => {
    const { supplier, recipient, address } = await agencyScenario()

    await replyWithPdf(client, inbound, { address, text: 'Prix ferme 30 jours.' })

    const [sent] = sentReplies()
    assert.equal(sent.data.supplierName, supplier.name)
    assert.equal(sent.data.body, 'Prix ferme 30 jours.')
    assert.deepEqual(sent.replyTo, [`agency-${recipient.agencyReplyToken}@${TEST_RELAY_DOMAIN}`])
    assert.lengthOf(sent.data.documents, 1)
    assert.equal(sent.data.documents[0].filename, 'devis été.pdf')
    assert.match(sent.data.documents[0].downloadPath, /^\/fr\/quote-documents\/\d+\/download$/)
  })

  test('le mail transmis ne révèle jamais le jeton du fournisseur', async ({ client, assert }) => {
    const { recipient, address } = await agencyScenario()

    await replyWithPdf(client, inbound, { address })

    sentReplies().forEach(({ replyTo, data }) => {
      assert.notInclude(JSON.stringify({ replyTo, data }), recipient.replyToken)
    })
  })

  test('un mail envoyé à l’adresse agence est un message de l’agence, jamais un devis du fournisseur (#226)', async ({
    client,
    assert,
  }) => {
    const { recipient } = await agencyScenario()
    inbound.provider.add('agency-reply', {
      to: `agency-${recipient.agencyReplyToken}@${TEST_RELAY_DOMAIN}`,
      from: 'Agence <owner@agence.test>',
      attachments: [{ filename: 'faux-devis.pdf', content: await realPdf() }],
    })

    const response = await deliver(client, 'agency-reply')

    response.assertStatus(200)
    const [message] = await Message.all()
    assert.equal(message.senderSide, 'agency')
    assert.lengthOf(await QuoteDocument.all(), 0)
    const unchanged = await RfqSupplier.findOrFail(recipient.id)
    assert.equal(unchanged.status, 'sent')
    assert.lengthOf(sentReplies(), 0)
  })

  test('chaque destinataire reçoit le mail dans sa langue', async ({ client, assert }) => {
    const { manager, address } = await agencyScenario()
    await manager.merge({ locale: 'en' }).save()

    await replyWithPdf(client, inbound, { address })

    const toManager = sentReplies().find(({ to }) => to === 'manager@agence.test')!
    assert.match(toManager.data.rfqPath, /^\/en\//)
    assert.match(toManager.data.documents[0].downloadPath, /^\/en\//)
  })

  test('la notification in-app nomme le fournisseur et mène à la demande', async ({
    client,
    assert,
  }) => {
    const { rfq, supplier, author, bystander, address } = await agencyScenario()

    await replyWithPdf(client, inbound, { address })

    const [notification] = await Notification.query().where('userId', author.id)
    assert.equal(notification.type, 'rfq.responded')
    assert.include(notification.data, {
      rfqId: rfq.id,
      rfqTitle: rfq.title,
      supplierName: supplier.name,
    })
    assert.lengthOf(await Notification.query().where('userId', bystander.id), 0)
  })
})

test.group('Réponse par mail — téléchargement du devis par l’agence (#225)', (group) => {
  useDatabase(group)
  const inbound = useFakeInboundMail(group)
  useFakeStorage(group)
  useFakeGhostscript(group, { available: false })
  group.each.setup(() => {
    mails = mail.fake().mails
    return () => mail.restore()
  })

  async function transmitted(client: ApiClient, subscribe = false) {
    const scenario = await agencyScenario()
    if (subscribe) await subscribeOrganization(scenario.supplier)
    await replyWithPdf(client, inbound, { address: scenario.address })
    const [document] = await QuoteDocument.query()
      .preload('attachment', (attachment) => attachment.preload('storageObject'))
      .preload('recipientStorageObject')
    const author = sentReplies().find(({ to }) => to === 'auteur@agence.test')!
    return { ...scenario, document, path: author.data.documents[0].downloadPath }
  }

  test('fournisseur non abonné : le lien du mail sert la copie au nom de l’agence', async ({
    client,
    assert,
  }) => {
    const { document, path, bystander } = await transmitted(client)
    assert.isNotNull(document.recipientStorageObjectId)

    // Tout membre de l'agence, pas seulement les destinataires du mail.
    const response = await download(client, path, bystander)

    response.assertStatus(200)
    response.assertHeader('content-type', 'application/pdf')
    response.assertHeader('cache-control', 'private, no-store')
    response.assertHeader('x-content-type-options', 'nosniff')
    assert.include(
      response.header('content-disposition'),
      "filename*=UTF-8''devis%20%C3%A9t%C3%A9.pdf"
    )
    assert.equal(Number(response.header('content-length')), document.recipientStorageObject.size)
    assert.notEqual(document.recipientStorageObject.size, document.attachment.storageObject.size)
  })

  test('fournisseur abonné : le lien du mail sert le PDF d’origine', async ({ client, assert }) => {
    const { document, path, author } = await transmitted(client, true)
    assert.isNull(document.recipientStorageObjectId)

    const response = await download(client, path, author)

    response.assertStatus(200)
    assert.equal(Number(response.header('content-length')), document.attachment.storageObject.size)
  })

  test('un membre d’une autre organisation est refusé', async ({ client }) => {
    const { path } = await transmitted(client)
    const outsider = await createMember(await OrganizationFactory.create(), 'owner')

    const response = await download(client, path, outsider)

    response.assertStatus(403)
  })

  test('le fournisseur lui-même n’a pas accès à la copie de l’agence', async ({ client }) => {
    const { path, supplier } = await transmitted(client)
    const supplierOwner = await createMember(supplier, 'owner')

    const response = await download(client, path, supplierOwner)

    response.assertStatus(403)
  })

  test('un visiteur non connecté passe par la connexion, puis revient au devis', async ({
    client,
  }) => {
    const { path } = await transmitted(client)

    const response = await download(client, path)

    response.assertStatus(302)
    response.assertHeader('location', `/fr/login?redirect=${encodeURIComponent(path)}`)
  })

  test('un identifiant non numérique est un 404', async ({ client }) => {
    const { author } = await agencyScenario()

    const response = await download(client, '/fr/quote-documents/abc/download', author)

    response.assertStatus(404)
  })

  test('un devis inconnu est un 404', async ({ client }) => {
    const { author } = await agencyScenario()

    const response = await download(client, '/fr/quote-documents/999999/download', author)

    response.assertStatus(404)
  })
})

test.group('Réponse par mail — services de la transmission (#225)', (group) => {
  useDatabase(group)
  const inbound = useFakeInboundMail(group)
  useFakeStorage(group)
  useFakeGhostscript(group, { available: false })
  group.each.setup(() => {
    mails = mail.fake().mails
    return () => mail.restore()
  })

  test('documentsOfReply : les devis du destinataire, jamais ceux d’un autre', async ({
    client,
    assert,
  }) => {
    const { recipient, address } = await agencyScenario()
    await replyWithPdf(client, inbound, { address })
    const [document] = await QuoteDocument.all()
    const quotes = await app.container.make(QuoteService)

    const mine = await quotes.documentsOfReply(recipient.id, [document.id, 999999])
    const elsewhere = await quotes.documentsOfReply(recipient.id + 1, [document.id])

    assert.deepEqual(
      mine.map(({ id, attachment }) => [id, attachment.filename]),
      [[document.id, 'devis été.pdf']]
    )
    assert.lengthOf(elsewhere, 0)
    assert.lengthOf(await quotes.documentsOfReply(recipient.id, []), 0)
  })

  test('NotificationService#notifyOncePerMessage : un doublon n’est ni créé ni une erreur', async ({
    assert,
  }) => {
    const { owner } = await agencyScenario()
    const notifications = await app.container.make(NotificationService)
    const data = { rfqId: 1, rfqTitle: 'Tote bags', supplierName: 'Textiles SA', messageId: 7 }

    const first = await notifications.notifyOncePerMessage(owner, 'rfq.responded', data)
    const again = await notifications.notifyOncePerMessage(owner, 'rfq.responded', data)
    const otherMessage = await notifications.notifyOncePerMessage(owner, 'rfq.responded', {
      ...data,
      messageId: 8,
    })

    assert.isNumber(first)
    assert.isNull(again)
    assert.isNumber(otherMessage)
    const stored = await Notification.findOrFail(first!)
    assert.deepEqual(stored.data, data)
    assert.lengthOf(await Notification.query().where('userId', owner.id), 2)
  })

  test('supplierReplied : deux traitements concurrents ne créent qu’une notification par personne', async ({
    assert,
  }) => {
    const { rfq, owner, manager } = await agencyScenario()
    const inApp = await app.container.make(InAppNotificationService)
    const notice = {
      rfqId: rfq.id,
      rfqTitle: rfq.title,
      supplierName: 'Textiles SA',
      messageId: 42,
      body: '',
      documents: [],
      replyTo: null,
      late: false,
    }
    const userIds = [owner.id, manager.id, owner.id]

    const created = await Promise.all([
      inApp.supplierReplied(userIds, notice),
      inApp.supplierReplied(userIds, notice),
    ])

    assert.equal(created[0] + created[1], 2)
    assert.lengthOf(await Notification.query().where('userId', owner.id), 1)
    assert.lengthOf(await Notification.query().where('userId', manager.id), 1)
    assert.equal(await inApp.supplierReplied(userIds, notice), 0)
  })

  test('recipientsFor : auteur et responsables, une fois chacun, dans leur langue', async ({
    assert,
  }) => {
    const { rfq, owner, manager } = await agencyScenario()
    await rfq.merge({ createdByUserId: owner.id }).save()
    await manager.merge({ locale: 'en' }).save()
    const service = await app.container.make(SupplierReplyNotificationService)

    const recipients = await service.recipientsFor(rfq)

    assert.sameDeepMembers(recipients, [
      { userId: owner.id, email: 'owner@agence.test', locale: 'fr' },
      { userId: manager.id, email: 'manager@agence.test', locale: 'en' },
    ])
  })

  test('recipientsFor : une demande sans auteur ne prévient que les responsables', async ({
    assert,
  }) => {
    const { rfq } = await agencyScenario()
    await rfq.merge({ createdByUserId: null }).save()
    const service = await app.container.make(SupplierReplyNotificationService)

    const recipients = await service.recipientsFor(rfq)
    const emails = recipients.map(({ email }) => email).sort()

    assert.deepEqual(emails, ['manager@agence.test', 'owner@agence.test'])
  })

  test('notify : un destinataire inconnu ne transmet rien', async ({ assert }) => {
    const service = await app.container.make(SupplierReplyNotificationService)

    const outcome = await service.notify({
      rfqSupplierId: 999999,
      messageId: 1,
      quoteDocumentIds: [],
      late: false,
    })

    assert.deepEqual(outcome, { mails: 0, notifications: 0 })
  })

  test('QuoteService#findDocument : un devis inconnu lève une 404', async ({ assert }) => {
    const quotes = await app.container.make(QuoteService)

    await assert.rejects(() => quotes.findDocument(999999), QuoteDocumentNotFoundException)
  })

  test('agencyAddressFor : une ligne tout juste créée est relue pour son jeton agence', async ({
    assert,
  }) => {
    const { rfq } = await sentRfq()
    const otherSupplier = await OrganizationFactory.apply('supplier').create()
    const fresh = await RfqSupplierFactory.apply('sent')
      .merge({ rfqId: rfq.id, supplierOrganizationId: otherSupplier.id })
      .create()
    // Généré par la base : absent de l'instance en mémoire.
    assert.isUndefined(fresh.agencyReplyToken)
    const addresses = await app.container.make(InboundAddressService)

    const address = await addresses.agencyAddressFor(fresh)

    const stored = await RfqSupplier.findOrFail(fresh.id)
    assert.equal(address, `agency-${stored.agencyReplyToken}@${TEST_RELAY_DOMAIN}`)
    assert.match(stored.agencyReplyToken, /^[0-9a-f]{32}$/)
  })

  test('agencyAddressFor : adresse agency- du couple, null si la réception est désactivée', async ({
    assert,
  }) => {
    const { recipient } = await sentRfq()
    const addresses = await app.container.make(InboundAddressService)

    assert.equal(
      await addresses.agencyAddressFor(recipient),
      `agency-${recipient.agencyReplyToken}@${TEST_RELAY_DOMAIN}`
    )
    // Le jeton du fournisseur, qui suffit à écrire en son nom, n'y figure pas.
    assert.notEqual(recipient.agencyReplyToken, recipient.replyToken)

    inboundMailConfig.enabled = false
    assert.isNull(await addresses.agencyAddressFor(recipient))
  })
})
