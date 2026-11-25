import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import emitter from '@adonisjs/core/services/emitter'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import inboundMailConfig from '#config/inbound_mail'
import InboundMailReceived from '#events/inbound_mail_received'
import AgencyMessageRelayedNotification from '#mails/agency_message_relayed_notification'
import SupplierReplyReceivedNotification from '#mails/supplier_reply_received_notification'
import Conversation from '#models/conversation'
import InboundMail from '#models/inbound_mail'
import Message from '#models/message'
import MessageReport from '#models/message_report'
import Notification from '#models/notification'
import Organization from '#models/organization'
import QuoteDocument from '#models/quote_document'
import RfqSupplier from '#models/rfq_supplier'
import InAppNotificationService from '#services/in_app_notification_service'
import InboundAddressService from '#services/inbound_address_service'
import MessageRelayService from '#services/message_relay_service'
import AdminInboundMailService from '#services/admin_inbound_mail_service'
import AgencyReplyService from '#services/agency_reply_service'
import ConversationService from '#services/conversation_service'
import RfqThreadService from '#services/rfq_thread_service'
import ConversationMessageRecorded from '#events/conversation_message_recorded'
import { ConversationAccessDeniedException } from '#exceptions/messaging_errors'
import { RfqSupplierNotFoundException } from '#exceptions/rfq_errors'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { deliver, sentRfq, TEST_RELAY_DOMAIN, useFakeInboundMail } from '#tests/utils/inbound_mail'
import { createMember, subscribeOrganization } from '#tests/utils/organizations'
import { useFakeGhostscript } from '#tests/utils/pdf'
import { useDatabase } from '#tests/utils/setup'
import { MessageFactory } from '#database/factories/message_factory'
import { InboundMailFactory } from '#database/factories/inbound_mail_factory'
import { THREAD_MESSAGES_LIMIT } from '#shared/types/conversation'
import { useFakeStorage } from '#tests/utils/storage'
import type User from '#models/user'
import type {
  AgencyMessageRelayedMailData,
  SupplierReplyReceivedMailData,
} from '#shared/types/mail'

let mails: ReturnType<typeof mail.fake>['mails']

/** Mail relayé au fournisseur : destinataire, données et message construit. */
function relayedToSupplier() {
  return mails
    .sent((mailer) => mailer instanceof AgencyMessageRelayedNotification)
    .map((mailer) => {
      const fields = mailer as unknown as { email: string; data: AgencyMessageRelayedMailData }
      const { message } = (mailer as AgencyMessageRelayedNotification).message.toJSON()
      return { to: fields.email, data: fields.data, message }
    })
}

/** Mail transmis à l'agence (#225) : destinataire, données et `Reply-To`. */
function relayedToAgency() {
  return mails
    .sent((mailer) => mailer instanceof SupplierReplyReceivedNotification)
    .map((mailer) => {
      const fields = mailer as unknown as { email: string; data: SupplierReplyReceivedMailData }
      const { message } = (mailer as SupplierReplyReceivedNotification).message.toJSON()
      return { to: fields.email, data: fields.data, replyTo: (message.replyTo ?? []) as string[] }
    })
}

/**
 * Agence « Agence Dupont » (auteur propriétaire), fournisseur non abonné avec un
 * propriétaire, demande envoyée : les deux adresses relais du couple.
 */
async function relayScenario() {
  const sent = await sentRfq()
  const buyer = await Organization.findOrFail(sent.rfq.buyerOrganizationId)
  await buyer.merge({ name: 'Agence Dupont' }).save()
  const author = await createMember(buyer, 'owner', {
    email: 'marie@agence-dupont.test',
    firstName: 'Marie',
    lastName: 'Dupont',
  })
  await sent.rfq.merge({ createdByUserId: author.id }).save()
  const supplierOwner = await createMember(sent.supplier, 'owner', {
    email: 'paul@fournisseur.test',
  })
  return {
    ...sent,
    buyer,
    author,
    supplierOwner,
    supplierAddress: sent.address,
    agencyAddress: `agency-${sent.recipient.agencyReplyToken}@${TEST_RELAY_DOMAIN}`,
  }
}

type Inbound = ReturnType<typeof useFakeInboundMail>

/** Un mail arrive à l'adresse relais `to`. */
async function mailFrom(
  client: ApiClient,
  inbound: Inbound,
  mailInput: {
    id: string
    to: string
    from: string
    text: string
    headers?: Record<string, string>
  }
) {
  inbound.provider.add(mailInput.id, mailInput)
  const response = await deliver(client, mailInput.id)
  response.assertStatus(200)
}

/** Adresse relais visée et texte d'un mail. */
interface MailTo {
  to: string
  text?: string
  from?: string
}

function agencyMail(
  client: ApiClient,
  inbound: Inbound,
  { to, text = 'Livraison avant le 15 ?', from = 'Marie Dupont <marie@agence-dupont.test>' }: MailTo
) {
  return mailFrom(client, inbound, {
    id: `agency-${text.length}-${Math.random()}`,
    to,
    from,
    text,
    headers: {
      'x-originating-ip': '[203.0.113.7]',
      'received': 'from mail.agence-dupont.test ([203.0.113.7])',
      'message-id': '<abc@agence-dupont.test>',
      'x-mailer': 'Outlook — Agence Dupont',
      'importance': 'high',
    },
  })
}

function supplierMail(client: ApiClient, inbound: Inbound, { to, text = 'Bonjour' }: MailTo) {
  return mailFrom(client, inbound, {
    id: `supplier-${Math.random()}`,
    to,
    from: 'Paul <paul@fournisseur.test>',
    text,
  })
}

/** Écrit dans un fil depuis l'application, comme le ferait l'écran. */
function postMessage(client: ApiClient, user: User, { path, body = 'Bonjour' }: PostedTo) {
  return client.post(path).withCsrfToken().loginAs(user).redirects(0).form({ body })
}

/** Route d'écriture d'un fil et texte du message. */
interface PostedTo {
  path: string
  body?: string
}

/** Même écriture en JSON : un refus d'autorisation garde son statut 403. */
function postAsJson(client: ApiClient, user: User, path: string) {
  return client
    .post(path)
    .json({ body: 'Bonjour' })
    .redirects(0)
    .withCsrfToken()
    .header('Accept', 'application/json')
    .loginAs(user)
}

test.group('Relais des échanges — résolution des adresses par côté (#226)', (group) => {
  useDatabase(group)
  useFakeInboundMail(group)

  test('une adresse par côté, chacune avec son propre jeton', async ({ assert }) => {
    const { recipient } = await relayScenario()
    const addresses = await app.container.make(InboundAddressService)

    assert.equal(
      await addresses.relayAddressFor(recipient, 'supplier'),
      `rfq-${recipient.replyToken}@${TEST_RELAY_DOMAIN}`
    )
    assert.equal(
      await addresses.relayAddressFor(recipient, 'agency'),
      `agency-${recipient.agencyReplyToken}@${TEST_RELAY_DOMAIN}`
    )
    assert.notEqual(recipient.replyToken, recipient.agencyReplyToken)
  })

  test('targetFrom et sideOf disent qui écrit ; une adresse inconnue vaut le fournisseur', async ({
    assert,
  }) => {
    const { recipient, supplierAddress, agencyAddress } = await relayScenario()
    const addresses = await app.container.make(InboundAddressService)

    assert.deepEqual(addresses.targetFrom([agencyAddress]), {
      side: 'agency',
      token: recipient.agencyReplyToken,
    })
    assert.equal(addresses.sideOf(agencyAddress), 'agency')
    assert.equal(addresses.sideOf(supplierAddress), 'supplier')
    assert.equal(addresses.sideOf('autre@exemple.test'), 'supplier')
    assert.equal(addresses.sideOf(null), 'supplier')
  })

  test('réception désactivée : aucune adresse relais', async ({ assert }) => {
    const { recipient } = await relayScenario()
    const addresses = await app.container.make(InboundAddressService)
    Object.assign(inboundMailConfig, { enabled: false })

    assert.isNull(await addresses.relayAddressFor(recipient, 'agency'))
    assert.isNull(addresses.targetFrom([`agency-${recipient.agencyReplyToken}@x.test`]))
  })
})

test.group('Relais des échanges — par mail (#226)', (group) => {
  useDatabase(group)
  const inbound = useFakeInboundMail(group)
  useFakeStorage(group)
  useFakeGhostscript(group, { available: false })
  group.each.setup(() => {
    mails = mail.fake().mails
    return () => mail.restore()
  })

  test('un mail de l’agence entre dans le fil comme son message, sans devis ni statut', async ({
    client,
    assert,
  }) => {
    const { recipient, agencyAddress } = await relayScenario()

    await agencyMail(client, inbound, { to: agencyAddress })

    const journal = await InboundMail.query().where('recipient', agencyAddress).firstOrFail()
    assert.equal(journal.status, 'processed')
    assert.equal(journal.rfqSupplierId, recipient.id)
    assert.isTrue(journal.senderKnown)
    const [message] = await Message.all()
    assert.equal(message.senderSide, 'agency')
    assert.equal(message.body, 'Livraison avant le 15 ?')
    assert.isNull(message.authorUserId)
    assert.lengthOf(await QuoteDocument.all(), 0)
    const unchanged = await RfqSupplier.findOrFail(recipient.id)
    assert.equal(unchanged.status, 'sent')
  })

  test('l’adresse `agency-` ne se résout jamais par le jeton du fournisseur, ni l’inverse', async ({
    client,
    assert,
  }) => {
    const { recipient } = await relayScenario()

    await agencyMail(client, inbound, { to: `agency-${recipient.replyToken}@${TEST_RELAY_DOMAIN}` })
    await supplierMail(client, inbound, {
      to: `rfq-${recipient.agencyReplyToken}@${TEST_RELAY_DOMAIN}`,
      text: 'Je me fais passer pour le fournisseur',
    })

    const journal = await InboundMail.all()
    assert.deepEqual(
      journal.map(({ rejectionReason }) => rejectionReason),
      ['unknown_address', 'unknown_address']
    )
    assert.lengthOf(await Message.all(), 0)
  })

  test('le message de l’agence est relayé au fournisseur : plateforme, Reply-To `rfq-`, en-têtes nettoyés', async ({
    client,
    assert,
  }) => {
    const { recipient, rfq, agencyAddress, supplierAddress } = await relayScenario()

    await agencyMail(client, inbound, { to: agencyAddress })

    const relayed = relayedToSupplier()
    assert.lengthOf(relayed, 1)
    const [sent] = relayed
    assert.equal(sent.to, 'contact@fournisseur.test')
    assert.deepEqual(sent.message.replyTo, [supplierAddress])
    assert.equal(sent.data.body, 'Livraison avant le 15 ?')
    assert.equal(sent.data.rfqTitle, rfq.title)
    assert.match(sent.data.rfqPath, new RegExp(`^/fr/supplier/rfqs/${rfq.id}$`))
    assert.deepEqual(sent.data.headers, { Importance: 'high' })
    assert.equal((sent.message.headers as Record<string, string>)['Importance'], 'high')
    assert.notInclude(JSON.stringify(sent.message), recipient.agencyReplyToken)
  })

  test('rien dans le mail relayé à un non abonné ne révèle l’agence, hors corps', async ({
    client,
    assert,
  }) => {
    const { agencyAddress } = await relayScenario()

    await agencyMail(client, inbound, { to: agencyAddress })

    const [sent] = relayedToSupplier()
    assert.isNull(sent.data.agencyName)
    const { subject, from, replyTo, headers } = sent.message
    const envelope = JSON.stringify({ subject, from, replyTo, headers })
    ;['Agence Dupont', 'agence-dupont', 'marie', '203.0.113.7', 'Outlook'].forEach((needle) =>
      assert.notInclude(envelope.toLowerCase(), needle.toLowerCase())
    )
  })

  test('un fournisseur abonné lit le nom de l’agence dans le mail relayé', async ({
    client,
    assert,
  }) => {
    const { supplier, agencyAddress } = await relayScenario()
    await subscribeOrganization(supplier)

    await agencyMail(client, inbound, { to: agencyAddress })

    const [sent] = relayedToSupplier()
    assert.equal(sent.data.agencyName, 'Agence Dupont')
    assert.include(String(sent.message.subject), 'Agence Dupont')
  })

  test('un mail de l’agence rejoué n’entre et ne part qu’une fois', async ({ client, assert }) => {
    const { recipient, agencyAddress } = await relayScenario()
    await agencyMail(client, inbound, { to: agencyAddress })
    const journal = await InboundMail.query().where('recipient', agencyAddress).firstOrFail()

    await emitter.emit(
      InboundMailReceived,
      new InboundMailReceived({
        inboundMailId: journal.id,
        rfqSupplierId: recipient.id,
        side: 'agency',
      })
    )

    assert.lengthOf(await Message.all(), 1)
    assert.lengthOf(relayedToSupplier(), 1)
  })

  test('un échange aller-retour complet par mail est enregistré et visible des deux côtés', async ({
    client,
    assert,
  }) => {
    const { rfq, author, supplierOwner, supplierAddress, agencyAddress } = await relayScenario()

    await supplierMail(client, inbound, {
      to: supplierAddress,
      text: 'Quelle couleur de marquage ?',
    })
    const [toAgency] = relayedToAgency().filter(({ to }) => to === 'marie@agence-dupont.test')
    assert.deepEqual(toAgency.replyTo, [agencyAddress])

    await agencyMail(client, inbound, { to: agencyAddress, text: 'Bleu Pantone 286, merci.' })
    assert.lengthOf(relayedToSupplier(), 1)

    await supplierMail(client, inbound, { to: supplierAddress, text: 'Entendu, devis demain.' })

    const agencyView = await client.get(`/fr/rfqs/${rfq.id}`).withInertia().loginAs(author)
    agencyView.assertStatus(200)
    const [thread] = agencyView.inertiaProps.threads
    assert.deepEqual(
      thread.messages.map(({ side, mine, viaMail }: Record<string, unknown>) => ({
        side,
        mine,
        viaMail,
      })),
      [
        { side: 'supplier', mine: false, viaMail: true },
        { side: 'agency', mine: true, viaMail: true },
        { side: 'supplier', mine: false, viaMail: true },
      ]
    )

    // L'agence voit qui a écrit au fournisseur ; le fournisseur ne lit jamais l'adresse de l'agence.
    assert.deepEqual(thread.messages[0].mailSender, {
      name: 'Paul',
      address: 'paul@fournisseur.test',
      known: true,
    })
    assert.equal(thread.messages[1].mailSender.address, 'marie@agence-dupont.test')

    const supplierView = await client
      .get(`/fr/supplier/rfqs/${rfq.id}`)
      .withInertia()
      .loginAs(supplierOwner)
    supplierView.assertStatus(200)
    assert.deepEqual(
      supplierView.inertiaProps.thread.messages.map(({ body }: { body: string }) => body),
      ['Quelle couleur de marquage ?', 'Bleu Pantone 286, merci.', 'Entendu, devis demain.']
    )
    const supplierThread = supplierView.inertiaProps.thread
    assert.isNull(supplierThread.messages[1].mailSender)
    assert.equal(supplierThread.messages[0].mailSender.address, 'paul@fournisseur.test')
    assert.notInclude(JSON.stringify(supplierThread), 'agence-dupont')
  })

  test('un mail à l’adresse `agency-` venu d’hors de l’agence est écarté, ni écrit ni relayé', async ({
    client,
    assert,
  }) => {
    const { agencyAddress } = await relayScenario()

    await agencyMail(client, inbound, { to: agencyAddress, from: 'inconnu@ailleurs.test' })

    const journal = await InboundMail.query().where('recipient', agencyAddress).firstOrFail()
    assert.equal(journal.status, 'rejected')
    assert.equal(journal.rejectionReason, 'unknown_sender')
    assert.lengthOf(await Message.all(), 0)
    assert.lengthOf(relayedToSupplier(), 0)
  })

  test('l’agence est prévenue dans l’application qu’un mail n’a pas été relayé, une fois', async ({
    client,
    assert,
  }) => {
    const { rfq, author, supplier, agencyAddress } = await relayScenario()

    await agencyMail(client, inbound, { to: agencyAddress, from: 'assistante@gmail.test' })
    const journal = await InboundMail.query().where('recipient', agencyAddress).firstOrFail()
    const agencyReplies = await app.container.make(AgencyReplyService)
    const again = await agencyReplies.refuse(journal.id)

    const notifications = await Notification.query().where('type', 'rfq.relay_refused')
    assert.equal(again, 0)
    assert.lengthOf(notifications, 1)
    assert.equal(notifications[0].userId, author.id)
    assert.deepEqual(notifications[0].data, {
      inboundMailId: journal.id,
      rfqId: rfq.id,
      rfqTitle: rfq.title,
      supplierName: supplier.name,
      senderAddress: 'assistante@gmail.test',
    })
  })

  test('AgencyReplyService#refuse : rien pour un mail inconnu ou écarté pour un autre motif', async ({
    assert,
  }) => {
    const { recipient, agencyAddress } = await relayScenario()
    const autoReply = await InboundMailFactory.merge({
      recipient: agencyAddress,
      rfqSupplierId: recipient.id,
      status: 'rejected',
      rejectionReason: 'auto_reply',
    }).create()
    const agencyReplies = await app.container.make(AgencyReplyService)

    assert.equal(await agencyReplies.refuse(999_999), 0)
    assert.equal(await agencyReplies.refuse(autoReply.id), 0)
    assert.lengthOf(await Notification.all(), 0)
  })

  test('un admin peut rattacher à la main un mail de l’agence écarté : il est alors relayé', async ({
    client,
    assert,
  }) => {
    const { recipient, agencyAddress } = await relayScenario()
    await agencyMail(client, inbound, { to: agencyAddress, from: 'assistante@gmail.test' })
    const journal = await InboundMail.query().where('recipient', agencyAddress).firstOrFail()
    const admin = await app.container.make(AdminInboundMailService)

    const outcome = await admin.attach(journal.id, recipient.id, { actor: null, ip: null })

    assert.equal(outcome, 'processed')
    const [message] = await Message.all()
    assert.equal(message.senderSide, 'agency')
    assert.lengthOf(relayedToSupplier(), 1)
  })

  test('l’historique cité d’une réponse n’entre pas dans le fil et n’est pas relayé', async ({
    client,
    assert,
  }) => {
    const { agencyAddress } = await relayScenario()
    const text = 'Oui, le 15 convient.\n\nLe 21 nov. 2026, Plateforme a écrit :\n> Livraison ?'

    await agencyMail(client, inbound, { to: agencyAddress, text })

    const [message] = await Message.all()
    assert.equal(message.body, 'Oui, le 15 convient.')
    assert.equal(relayedToSupplier()[0].data.body, 'Oui, le 15 convient.')
  })

  test('SupplierReplyService : la réponse du fournisseur, côté fournisseur, sans citation', async ({
    client,
    assert,
  }) => {
    const { supplierAddress } = await relayScenario()
    const text = 'Devis en pièce jointe.\n\nOn Fri, Nov 21, 2026, Platform wrote:\n> Bonjour'

    await supplierMail(client, inbound, { to: supplierAddress, text })

    const [message] = await Message.all()
    assert.equal(message.senderSide, 'supplier')
    assert.equal(message.body, 'Devis en pièce jointe.')
  })

  test('AgencyReplyService#record : mail inconnu, sans destinataire ou vide', async ({
    client,
    assert,
  }) => {
    const { agencyAddress } = await relayScenario()
    const service = await app.container.make(AgencyReplyService)
    inbound.provider.add('empty', {
      to: agencyAddress,
      from: 'marie@agence-dupont.test',
      text: '   ',
    })
    await deliver(client, 'empty')
    const empty = await InboundMail.query().where('providerMessageId', 'empty').firstOrFail()

    assert.isNull(await service.record(999999))
    assert.isNull(await service.record(empty.id))
    assert.lengthOf(await Message.all(), 0)
  })

  test('MessageRelayService#relay : un destinataire inconnu ne relaie rien', async ({ assert }) => {
    const relay = await app.container.make(MessageRelayService)

    const queued = await relay.relay({
      rfqSupplierId: 999999,
      conversationId: 1,
      messageId: 1,
      side: 'agency',
    })

    assert.equal(queued, 0)
    assert.lengthOf(relayedToSupplier(), 0)
  })
})

test.group('Relais des échanges — depuis l’application (#226)', (group) => {
  useDatabase(group)
  useFakeInboundMail(group)
  group.each.setup(() => {
    mails = mail.fake().mails
    return () => mail.restore()
  })

  test('l’agence écrit depuis sa demande : message dans le fil, relayé au fournisseur', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, author, supplierAddress } = await relayScenario()

    const response = await postMessage(client, author, {
      path: `/fr/rfqs/${rfq.id}/suppliers/${recipient.id}/messages`,
      body: '  Pouvez-vous ajouter 100 pièces ?  ',
    })

    response.assertStatus(302)
    const conversation = await Conversation.findByOrFail('rfqSupplierId', recipient.id)
    const [message] = await Message.query().where('conversationId', conversation.id)
    assert.equal(message.body, 'Pouvez-vous ajouter 100 pièces ?')
    assert.equal(message.senderSide, 'agency')
    assert.equal(message.authorUserId, author.id)
    const [sent] = relayedToSupplier()
    assert.equal(sent.data.body, 'Pouvez-vous ajouter 100 pièces ?')
    assert.deepEqual(sent.message.replyTo, [supplierAddress])
    assert.deepEqual(sent.data.headers, {})
  })

  test('le fournisseur écrit depuis la demande reçue : message relayé à l’agence', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, supplierOwner, agencyAddress } = await relayScenario()

    const response = await postMessage(client, supplierOwner, {
      path: `/fr/supplier/rfqs/${rfq.id}/messages`,
      body: 'Délai de 3 semaines.',
    })

    response.assertStatus(302)
    const [message] = await Message.all()
    assert.equal(message.senderSide, 'supplier')
    const conversation = await Conversation.findOrFail(message.conversationId)
    assert.equal(conversation.rfqSupplierId, recipient.id)
    const toAgency = relayedToAgency()
    assert.deepEqual(
      toAgency.map(({ to }) => to),
      ['marie@agence-dupont.test']
    )
    assert.equal(toAgency[0].data.body, 'Délai de 3 semaines.')
    assert.deepEqual(toAgency[0].data.documents, [])
    assert.deepEqual(toAgency[0].replyTo, [agencyAddress])
  })

  test('les deux côtés partagent un seul fil', async ({ client, assert }) => {
    const { rfq, recipient, author, supplierOwner } = await relayScenario()

    await postMessage(client, author, {
      path: `/fr/rfqs/${rfq.id}/suppliers/${recipient.id}/messages`,
    })
    await postMessage(client, supplierOwner, { path: `/fr/supplier/rfqs/${rfq.id}/messages` })

    assert.lengthOf(await Conversation.all(), 1)
    assert.lengthOf(await Message.all(), 2)
  })

  test('un message vide est refusé par la validation, rien n’est écrit ni envoyé', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, author } = await relayScenario()

    const response = await postMessage(client, author, {
      path: `/fr/rfqs/${rfq.id}/suppliers/${recipient.id}/messages`,
      body: '   ',
    })

    response.assertStatus(302)
    assert.property(response.flashMessages().inputErrorsBag ?? {}, 'body')
    assert.lengthOf(await Message.all(), 0)
    assert.lengthOf(relayedToSupplier(), 0)
  })

  test('un fil bloqué par la plateforme refuse l’écriture par un message flash', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, author } = await relayScenario()
    await postMessage(client, author, {
      path: `/fr/rfqs/${rfq.id}/suppliers/${recipient.id}/messages`,
    })
    await Conversation.query()
      .where('rfqSupplierId', recipient.id)
      .update({ blockedAt: DateTime.now().toJSDate() })

    const response = await postMessage(client, author, {
      path: `/fr/rfqs/${rfq.id}/suppliers/${recipient.id}/messages`,
    })

    response.assertStatus(302)
    assert.match(String(response.flashMessages().error), /bloqué/)
    assert.lengthOf(await Message.all(), 1)
  })

  test('canMessageRfqSupplier : un destinataire pas encore notifié est refusé (403)', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, author } = await relayScenario()
    await recipient.merge({ status: 'pending' }).save()

    const response = await postAsJson(
      client,
      author,
      `/fr/rfqs/${rfq.id}/suppliers/${recipient.id}/messages`
    )

    response.assertStatus(403)
    assert.lengthOf(await Message.all(), 0)
  })

  test('canMessageRfqBuyer : un simple membre du fournisseur est refusé (403)', async ({
    client,
    assert,
  }) => {
    const { rfq, supplier } = await relayScenario()
    const member = await createMember(supplier, 'member')

    const response = await postAsJson(client, member, `/fr/supplier/rfqs/${rfq.id}/messages`)

    response.assertStatus(403)
    assert.lengthOf(await Message.all(), 0)
  })

  test('un fil clos (adresse relais expirée) refuse l’écriture des deux côtés (403)', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, author, supplierOwner } = await relayScenario()
    const endedAt = DateTime.now().minus({ days: inboundMailConfig.graceDays + 1 })
    await rfq.merge({ status: 'closed', closedAt: endedAt }).save()

    const asAgency = await postAsJson(
      client,
      author,
      `/fr/rfqs/${rfq.id}/suppliers/${recipient.id}/messages`
    )
    const asSupplier = await postAsJson(
      client,
      supplierOwner,
      `/fr/supplier/rfqs/${rfq.id}/messages`
    )

    asAgency.assertStatus(403)
    asSupplier.assertStatus(403)
    assert.lengthOf(await Message.all(), 0)
  })

  test('une demande close depuis peu reste ouverte à l’écriture (délai de grâce)', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, author } = await relayScenario()
    await rfq.merge({ status: 'closed', closedAt: DateTime.now().minus({ days: 1 }) }).save()

    const response = await postMessage(client, author, {
      path: `/fr/rfqs/${rfq.id}/suppliers/${recipient.id}/messages`,
    })

    response.assertStatus(302)
    assert.lengthOf(await Message.all(), 1)
  })

  test('une autre organisation ne trouve ni la demande ni le destinataire (404)', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient } = await relayScenario()
    const stranger = await createMember(await OrganizationFactory.create(), 'owner')

    const asAgency = await postMessage(client, stranger, {
      path: `/fr/rfqs/${rfq.id}/suppliers/${recipient.id}/messages`,
    })
    const asSupplier = await postMessage(client, stranger, {
      path: `/fr/supplier/rfqs/${rfq.id}/messages`,
    })

    asAgency.assertStatus(404)
    asSupplier.assertStatus(404)
    assert.lengthOf(await Message.all(), 0)
  })

  test('un non connecté est renvoyé vers la connexion', async ({ client, assert }) => {
    const { rfq, recipient } = await relayScenario()

    const response = await client
      .post(`/fr/rfqs/${rfq.id}/suppliers/${recipient.id}/messages`)
      .withCsrfToken()
      .redirects(0)
      .form({ body: 'Bonjour' })

    assert.oneOf(response.status(), [302, 401])
    assert.lengthOf(await Message.all(), 0)
  })
})

test.group('Relais des échanges — écrans et signalement (#226)', (group) => {
  useDatabase(group)
  useFakeInboundMail(group)
  group.each.setup(() => {
    mails = mail.fake().mails
    return () => mail.restore()
  })

  test('le fournisseur non abonné ne lit ni le nom de l’agence ni celui de son auteur', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, author, supplierOwner } = await relayScenario()
    await postMessage(client, author, {
      path: `/fr/rfqs/${rfq.id}/suppliers/${recipient.id}/messages`,
    })

    const response = await client
      .get(`/fr/supplier/rfqs/${rfq.id}`)
      .withInertia()
      .loginAs(supplierOwner)

    const { thread } = response.inertiaProps
    assert.isNull(thread.counterpartName)
    assert.isTrue(thread.canWrite)
    assert.isNull(thread.messages[0].authorName)
    assert.isFalse(thread.messages[0].mine)
    assert.notInclude(JSON.stringify(thread), 'Dupont')
  })

  test('l’agence voit un fil par destinataire notifié, nommé, et ses propres auteurs', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, supplier, author } = await relayScenario()
    await postMessage(client, author, {
      path: `/fr/rfqs/${rfq.id}/suppliers/${recipient.id}/messages`,
    })

    const response = await client.get(`/fr/rfqs/${rfq.id}`).withInertia().loginAs(author)

    const { threads } = response.inertiaProps
    assert.lengthOf(threads, 1)
    assert.equal(threads[0].counterpartName, supplier.name)
    assert.isTrue(threads[0].canWrite)
    assert.equal(threads[0].messages[0].authorName, 'Marie Dupont')
    assert.isTrue(threads[0].messages[0].mine)
  })

  test('un fil sans échange s’affiche vide ; un fil bloqué ne s’écrit plus', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, author, supplierOwner } = await relayScenario()

    const empty = await client.get(`/fr/rfqs/${rfq.id}`).withInertia().loginAs(author)
    assert.deepEqual(empty.inertiaProps.threads[0].messages, [])

    await postMessage(client, author, {
      path: `/fr/rfqs/${rfq.id}/suppliers/${recipient.id}/messages`,
    })
    await Conversation.query()
      .where('rfqSupplierId', recipient.id)
      .update({ blockedAt: DateTime.now().toJSDate() })
    const blocked = await client
      .get(`/fr/supplier/rfqs/${rfq.id}`)
      .withInertia()
      .loginAs(supplierOwner)
    assert.isTrue(blocked.inertiaProps.thread.blocked)
    assert.isFalse(blocked.inertiaProps.thread.canWrite)
  })

  test('un fil clos s’affiche clos, sans écriture, des deux côtés', async ({ client, assert }) => {
    const { rfq, author, supplierOwner } = await relayScenario()
    const endedAt = DateTime.now().minus({ days: inboundMailConfig.graceDays + 1 })
    await rfq.merge({ status: 'expired', expiredAt: endedAt }).save()

    const agency = await client.get(`/fr/rfqs/${rfq.id}`).withInertia().loginAs(author)
    const supplierView = await client
      .get(`/fr/supplier/rfqs/${rfq.id}`)
      .withInertia()
      .loginAs(supplierOwner)

    const [agencyThread] = agency.inertiaProps.threads
    assert.include(agencyThread, { closed: true, canWrite: false })
    assert.include(supplierView.inertiaProps.thread, { closed: true, canWrite: false })
  })

  test('le signalement existant fonctionne sur un message relayé, des deux côtés', async ({
    client,
    assert,
  }) => {
    const { rfq, recipient, author, supplierOwner } = await relayScenario()
    await postMessage(client, author, {
      path: `/fr/rfqs/${rfq.id}/suppliers/${recipient.id}/messages`,
    })
    await postMessage(client, supplierOwner, { path: `/fr/supplier/rfqs/${rfq.id}/messages` })
    const [fromAgency, fromSupplier] = await Message.query().orderBy('id')

    const bySupplier = await client
      .post(`/fr/messages/${fromAgency.id}/report`)
      .withCsrfToken()
      .loginAs(supplierOwner)
      .redirects(0)
      .form({ reason: 'off_platform' })
    const byAgency = await client
      .post(`/fr/messages/${fromSupplier.id}/report`)
      .withCsrfToken()
      .loginAs(author)
      .redirects(0)
      .form({ reason: 'spam' })

    bySupplier.assertStatus(302)
    byAgency.assertStatus(302)
    const reports = await MessageReport.query().orderBy('id')
    assert.deepEqual(
      reports.map(({ messageId, reporterUserId }) => ({ messageId, reporterUserId })),
      [
        { messageId: fromAgency.id, reporterUserId: supplierOwner.id },
        { messageId: fromSupplier.id, reporterUserId: author.id },
      ]
    )
  })
})

test.group('Relais des échanges — services (#226)', (group) => {
  useDatabase(group)
  useFakeInboundMail(group)
  group.each.setup(() => {
    mails = mail.fake().mails
    return () => mail.restore()
  })

  test('ConversationService#post : un côté explicite qui n’est pas celui de l’auteur est refusé', async ({
    assert,
  }) => {
    const { recipient, rfq, author, supplierOwner } = await relayScenario()
    const conversations = await app.container.make(ConversationService)
    const threads = await app.container.make(RfqThreadService)
    recipient.$setRelated('rfq', rfq)
    await threads.post(recipient, author, { body: 'Ouverture', side: 'agency' })
    const conversation = await Conversation.findByOrFail('rfqSupplierId', recipient.id)

    await assert.rejects(
      () => conversations.post(conversation, author, { body: 'Usurpation', side: 'supplier' }),
      ConversationAccessDeniedException
    )
    const derived = await conversations.post(conversation, supplierOwner, 'Texte seul')
    assert.equal(derived.senderSide, 'supplier')
    assert.lengthOf(await Message.all(), 2)
  })

  test('RfqThreadService#post annonce le message à relayer', async () => {
    const { recipient, rfq, supplierOwner } = await relayScenario()
    const threads = await app.container.make(RfqThreadService)
    const announced = emitter.fake([ConversationMessageRecorded])
    recipient.$setRelated('rfq', rfq)

    const recorded = await threads.post(recipient, supplierOwner, {
      body: 'Bonjour',
      side: 'supplier',
    })

    try {
      announced.assertEmitted(ConversationMessageRecorded, ({ data }) => {
        return data.message.messageId === recorded.messageId && data.message.side === 'supplier'
      })
    } finally {
      emitter.restore()
    }
  })

  test('InAppNotificationService#agencyMailRefused : une fois par utilisateur et par mail', async ({
    assert,
  }) => {
    const { rfq, author, supplier } = await relayScenario()
    const inApp = await app.container.make(InAppNotificationService)
    const notice = {
      inboundMailId: 8,
      rfqId: rfq.id,
      rfqTitle: rfq.title,
      supplierName: supplier.name,
      senderAddress: 'assistante@gmail.test',
    }

    const first = await inApp.agencyMailRefused([author.id, author.id], notice)
    const replayed = await inApp.agencyMailRefused([author.id], notice)
    const otherMail = await inApp.agencyMailRefused([author.id], { ...notice, inboundMailId: 9 })
    const nobody = await inApp.agencyMailRefused([], notice)

    assert.deepEqual([first, replayed, otherMail, nobody], [1, 0, 1, 0])
    assert.lengthOf(await Notification.query().where('userId', author.id), 2)
  })

  test('RfqThreadService#isClosed : clos passé le délai de grâce de l’adresse relais', async ({
    assert,
  }) => {
    const { rfq } = await relayScenario()
    const threads = await app.container.make(RfqThreadService)

    assert.isFalse(threads.isClosed(rfq))
    rfq.merge({ status: 'closed', closedAt: DateTime.now().minus({ days: 1 }) })
    assert.isFalse(threads.isClosed(rfq))
    rfq.merge({ closedAt: DateTime.now().minus({ days: inboundMailConfig.graceDays + 1 }) })
    assert.isTrue(threads.isClosed(rfq))
  })

  test('RfqThreadService : destinataires introuvables (autre agence, encore en attente)', async ({
    assert,
  }) => {
    const { recipient, rfq, buyer, supplier } = await relayScenario()
    const threads = await app.container.make(RfqThreadService)
    const elsewhere = await OrganizationFactory.create()

    const found = await threads.recipientForBuyer(rfq.id, recipient.id, buyer.id)
    assert.equal(found.id, recipient.id)
    await assert.rejects(
      () => threads.recipientForBuyer(rfq.id, recipient.id, elsewhere.id),
      RfqSupplierNotFoundException
    )
    await recipient.merge({ status: 'pending' }).save()
    await assert.rejects(
      () => threads.recipientForSupplier(rfq.id, supplier.id),
      RfqSupplierNotFoundException
    )
  })

  test('RfqThreadService#threadsFor : rien à lire sans destinataire, messages masqués exclus', async ({
    assert,
  }) => {
    const { recipient, rfq, author } = await relayScenario()
    const threads = await app.container.make(RfqThreadService)
    recipient.$setRelated('rfq', rfq)
    await threads.post(recipient, author, { body: 'Visible', side: 'agency' })
    const hidden = await threads.post(recipient, author, { body: 'Masqué', side: 'agency' })
    await Message.query()
      .where('id', hidden.messageId)
      .update({ hiddenAt: DateTime.now().toJSDate() })

    const none = await threads.threadsFor([])
    const loaded = await threads.threadsFor([recipient.id])
    const conversation = loaded.get(recipient.id)!

    assert.equal(none.size, 0)
    assert.isFalse(conversation.hasOlder)
    assert.deepEqual(
      conversation.messages.map(({ body }) => body),
      ['Visible']
    )
  })

  test('RfqThreadService#threadsFor : seuls les derniers messages, et s’il en reste', async ({
    assert,
  }) => {
    const { recipient, rfq, author } = await relayScenario()
    const threads = await app.container.make(RfqThreadService)
    recipient.$setRelated('rfq', rfq)
    const first = await threads.post(recipient, author, { body: 'Le plus ancien', side: 'agency' })
    const start = DateTime.now().minus({ days: 1 })
    await MessageFactory.merge({ conversationId: first.conversationId })
      .tap((message, { faker }) => {
        message.createdAt = start.plus({ seconds: faker.number.int({ min: 1, max: 3600 }) })
      })
      .createMany(THREAD_MESSAGES_LIMIT)
    await Message.query().where('id', first.messageId).update({ createdAt: start.toJSDate() })

    const threadsByRecipient = await threads.threadsFor([recipient.id])
    const loaded = threadsByRecipient.get(recipient.id)!

    assert.isTrue(loaded.hasOlder)
    assert.lengthOf(loaded.messages, THREAD_MESSAGES_LIMIT)
    assert.notInclude(
      loaded.messages.map(({ body }) => body),
      'Le plus ancien'
    )
    const times = loaded.messages.map(({ createdAt }) => createdAt.toMillis())
    assert.deepEqual(
      times,
      [...times].sort((a, b) => a - b)
    )
  })
})
