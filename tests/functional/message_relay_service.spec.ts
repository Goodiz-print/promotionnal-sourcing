import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import mail from '@adonisjs/mail/services/main'
import SendMailJob from '#jobs/send_mail_job'
import AgencyMessageRelayedNotification from '#mails/agency_message_relayed_notification'
import SupplierReplyReceivedNotification from '#mails/supplier_reply_received_notification'
import Organization from '#models/organization'
import RfqSupplier from '#models/rfq_supplier'
import MessageAttachment from '#models/message_attachment'
import MessageRelayService from '#services/message_relay_service'
import RfqNotificationService from '#services/rfq_notification_service'
import { ConversationFactory } from '#database/factories/conversation_factory'
import { InboundMailFactory } from '#database/factories/inbound_mail_factory'
import { MessageFactory } from '#database/factories/message_factory'
import { StorageObjectFactory } from '#database/factories/storage_object_factory'
import { sentRfq, TEST_RELAY_DOMAIN, useFakeInboundMail } from '#tests/utils/inbound_mail'
import { createMember, subscribeOrganization } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type { AgencyMessageRelayedMailData } from '#shared/types/mail'
import type { ConversationSide } from '#shared/types/conversation'

let mails: ReturnType<typeof mail.fake>['mails']

/** Mails relayés au fournisseur : destinataire, données et en-têtes construits. */
function relayedToSupplier() {
  return mails
    .sent((mailer) => mailer instanceof AgencyMessageRelayedNotification)
    .map((mailer) => {
      const fields = mailer as unknown as { email: string; data: AgencyMessageRelayedMailData }
      const { message } = (mailer as AgencyMessageRelayedNotification).message.toJSON()
      return { to: fields.email, data: fields.data, message }
    })
}

/** Demande envoyée à « Fournisseur » ; agence « Agence Dupont » et son propriétaire. */
async function scenario() {
  const sent = await sentRfq()
  const buyer = await Organization.findOrFail(sent.rfq.buyerOrganizationId)
  await buyer.merge({ name: 'Agence Dupont' }).save()
  const owner = await createMember(buyer, 'owner', { email: 'marie@agence-dupont.test' })
  await sent.rfq.merge({ createdByUserId: owner.id }).save()
  const conversation = await ConversationFactory.merge({
    buyerOrganizationId: buyer.id,
    supplierOrganizationId: sent.supplier.id,
    rfqId: sent.rfq.id,
    rfqSupplierId: sent.recipient.id,
  }).create()
  return { ...sent, buyer, owner, conversation }
}

type Scenario = Awaited<ReturnType<typeof scenario>>

/** Annonce d'un message du fil, comme `ConversationMessageRecorded` la porte. */
function recorded(
  context: Scenario,
  { messageId, side }: { messageId: number; side: ConversationSide }
) {
  return {
    rfqSupplierId: context.recipient.id,
    conversationId: context.conversation.id,
    messageId,
    side,
  }
}

test.group('MessageRelayService#relay (#226)', (group) => {
  useDatabase(group)
  useFakeInboundMail(group)
  group.each.setup(() => {
    mails = mail.fake().mails
    return () => mail.restore()
  })

  test('un message de l’agence part à chaque adresse du fournisseur, anonyme', async ({
    assert,
  }) => {
    const context = await scenario()
    const message = await MessageFactory.apply('fromAgency')
      .merge({ conversationId: context.conversation.id, body: 'Livraison avant le 15 ?' })
      .create()
    const relay = await app.container.make(MessageRelayService)

    const queued = await relay.relay(recorded(context, { messageId: message.id, side: 'agency' }))

    const sent = relayedToSupplier()
    assert.equal(queued, 1)
    assert.deepEqual(
      sent.map(({ to }) => to),
      ['contact@fournisseur.test']
    )
    assert.deepInclude(sent[0].data, {
      agencyName: null,
      rfqTitle: context.rfq.title,
      body: 'Livraison avant le 15 ?',
      attachments: [],
      replyTo: `rfq-${context.recipient.replyToken}@${TEST_RELAY_DOMAIN}`,
      headers: {},
    })
    assert.include(sent[0].data.rfqPath, `/supplier/rfqs/${context.rfq.id}`)
  })

  test('vise les mêmes adresses que la demande (`addressesFor`), une par répondant', async ({
    assert,
  }) => {
    const context = await scenario()
    await context.supplier.merge({ email: null }).save()
    await createMember(context.supplier, 'owner', { email: 'paul@fournisseur.test' })
    await createMember(context.supplier, 'admin', { email: 'lea@fournisseur.test' })
    await createMember(context.supplier, 'member', { email: 'stagiaire@fournisseur.test' })
    const message = await MessageFactory.apply('fromAgency')
      .merge({ conversationId: context.conversation.id })
      .create()
    const relay = await app.container.make(MessageRelayService)
    const rfqMails = await app.container.make(RfqNotificationService)
    const recipient = await RfqSupplier.query()
      .where('id', context.recipient.id)
      .preload('supplierOrganization')
      .firstOrFail()
    const expected = await rfqMails.addressesFor(recipient)

    const queued = await relay.relay(recorded(context, { messageId: message.id, side: 'agency' }))

    assert.equal(queued, 2)
    assert.sameMembers(
      relayedToSupplier().map(({ to }) => to),
      expected.map(({ email }) => email)
    )
    assert.sameMembers(
      expected.map(({ email }) => email),
      ['paul@fournisseur.test', 'lea@fournisseur.test']
    )
  })

  test('un fournisseur abonné lit le nom de l’agence', async ({ assert }) => {
    const context = await scenario()
    await subscribeOrganization(context.supplier)
    const message = await MessageFactory.apply('fromAgency')
      .merge({ conversationId: context.conversation.id })
      .create()
    const relay = await app.container.make(MessageRelayService)

    await relay.relay(recorded(context, { messageId: message.id, side: 'agency' }))

    assert.equal(relayedToSupplier()[0].data.agencyName, 'Agence Dupont')
  })

  test('un mail de l’agence : seuls ses en-têtes de priorité et le nom de ses fichiers passent', async ({
    assert,
  }) => {
    const context = await scenario()
    const inbound = await InboundMailFactory.merge({
      recipient: `agency-${context.recipient.agencyReplyToken}@${TEST_RELAY_DOMAIN}`,
      rfqSupplierId: context.recipient.id,
      status: 'processed',
      headers: {
        'importance': 'high',
        'x-originating-ip': '[203.0.113.7]',
        'received': 'from mail.agence-dupont.test',
      },
    }).create()
    const message = await MessageFactory.apply('fromAgency')
      .merge({ conversationId: context.conversation.id, inboundMailId: inbound.id })
      .create()
    const stored = await StorageObjectFactory.create()
    await MessageAttachment.create({
      messageId: message.id,
      storageObjectId: stored.id,
      filename: 'plan.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    })
    const relay = await app.container.make(MessageRelayService)

    await relay.relay(recorded(context, { messageId: message.id, side: 'agency' }))

    const [sent] = relayedToSupplier()
    assert.deepEqual(sent.data.headers, { Importance: 'high' })
    assert.deepEqual(sent.data.attachments, ['plan.pdf'])
    assert.notInclude(JSON.stringify(sent.message), '203.0.113.7')
    assert.notInclude(JSON.stringify(sent.message), 'agence-dupont')
  })

  test('un message du fournisseur part à l’agence comme sa réponse, sans devis', async ({
    assert,
  }) => {
    const context = await scenario()
    const message = await MessageFactory.merge({ conversationId: context.conversation.id }).create()
    const relay = await app.container.make(MessageRelayService)

    const queued = await relay.relay(recorded(context, { messageId: message.id, side: 'supplier' }))

    const sent = mails.sent((mailer) => mailer instanceof SupplierReplyReceivedNotification)
    assert.equal(queued, 1)
    assert.lengthOf(sent, 1)
    assert.lengthOf(relayedToSupplier(), 0)
  })

  test('rejoué, le relais n’envoie rien de plus (clé du mail)', async ({ assert }) => {
    const context = await scenario()
    const message = await MessageFactory.apply('fromAgency')
      .merge({ conversationId: context.conversation.id })
      .create()
    const relay = await app.container.make(MessageRelayService)
    const announced = recorded(context, { messageId: message.id, side: 'agency' })

    await relay.relay(announced)
    await relay.relay(announced)

    assert.lengthOf(relayedToSupplier(), 1)
  })

  test('un destinataire inconnu ne relaie rien', async ({ assert }) => {
    const context = await scenario()
    const relay = await app.container.make(MessageRelayService)

    const queued = await relay.relay({
      ...recorded(context, { messageId: 1, side: 'agency' }),
      rfqSupplierId: 999_999,
    })

    assert.equal(queued, 0)
    assert.lengthOf(relayedToSupplier(), 0)
  })

  test('un échec de mise en queue est loggué, pas propagé, et non compté', async ({ assert }) => {
    const context = await scenario()
    const message = await MessageFactory.apply('fromAgency')
      .merge({ conversationId: context.conversation.id })
      .create()
    const relay = await app.container.make(MessageRelayService)
    const dispatch = SendMailJob.dispatch
    Object.assign(SendMailJob, {
      dispatch: () => Promise.reject(new Error('queue indisponible')),
    })

    try {
      const queued = await relay.relay(recorded(context, { messageId: message.id, side: 'agency' }))
      assert.equal(queued, 0)
    } finally {
      Object.assign(SendMailJob, { dispatch })
    }
    assert.lengthOf(relayedToSupplier(), 0)
  })
})
