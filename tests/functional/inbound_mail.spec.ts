import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import app from '@adonisjs/core/services/app'
import emitter from '@adonisjs/core/services/emitter'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import { InboundMailFactory } from '#database/factories/inbound_mail_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqItemFactory } from '#database/factories/rfq_item_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import InboundMailReceived from '#events/inbound_mail_received'
import RfqReceivedNotification from '#mails/rfq_received_notification'
import InboundMail from '#models/inbound_mail'
import InboundMailService from '#services/inbound_mail_service'
import RfqSupplier from '#models/rfq_supplier'
import StorageObject from '#models/storage_object'
import { TEST_RELAY_DOMAIN, useFakeInboundMail } from '#tests/utils/inbound_mail'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import { useFakeStorage } from '#tests/utils/storage'
import type Organization from '#models/organization'
import type Rfq from '#models/rfq'

/** Demande publiée, envoyée à un fournisseur : le couple visé par l'adresse relais. */
async function sentRfq(
  rfqState: 'published' | 'expired' = 'published'
): Promise<{ rfq: Rfq; supplier: Organization; recipient: RfqSupplier; address: string }> {
  const buyer = await OrganizationFactory.create()
  const supplier = await OrganizationFactory.apply('supplier')
    .merge({ email: 'contact@fournisseur.test' })
    .create()
  const rfq = await RfqFactory.apply(rfqState).merge({ buyerOrganizationId: buyer.id }).create()
  const created = await RfqSupplierFactory.apply('sent')
    .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id })
    .create()
  // Le jeton est généré par la base : relire la ligne.
  const recipient = await RfqSupplier.findOrFail(created.id)

  return {
    rfq,
    supplier,
    recipient,
    address: `rfq-${recipient.replyToken}@${TEST_RELAY_DOMAIN}`,
  }
}

/** Le prestataire appelle le webhook : sans session ni jeton CSRF. */
function deliver(client: ApiClient, id: string, signature = 'valid') {
  return client.post('/webhooks/inbound-mail').header('x-test-signature', signature).json({ id })
}

test.group('Mails entrants — webhook de réception', (group) => {
  useDatabase(group)
  const inbound = useFakeInboundMail(group)
  const storage = useFakeStorage(group)

  test('une réponse signée est rattachée au bon couple demande / fournisseur', async ({
    client,
    assert,
  }) => {
    const { recipient, address } = await sentRfq()
    const other = await sentRfq()
    const events: InboundMailReceived[] = []
    emitter.on(InboundMailReceived, (event) => {
      events.push(event)
    })
    inbound.provider.add('mail-1', {
      to: address,
      from: 'Contact <Contact@Fournisseur.test>',
      text: 'Voici notre devis.',
      attachments: [{ filename: 'devis.pdf', content: '%PDF-1.7 devis' }],
    })

    const response = await deliver(client, 'mail-1')

    response.assertStatus(200)
    response.assertBodyContains({ received: true, receipt: 'queued' })
    const journal = await InboundMail.query().preload('attachments').firstOrFail()
    assert.equal(journal.status, 'processed')
    assert.equal(journal.rfqSupplierId, recipient.id)
    assert.notEqual(journal.rfqSupplierId, other.recipient.id)
    assert.equal(journal.recipient, address)
    assert.equal(journal.senderAddress, 'contact@fournisseur.test')
    assert.equal(journal.senderName, 'Contact')
    assert.isTrue(journal.senderKnown)
    assert.equal(journal.textBody, 'Voici notre devis.')

    // La pièce jointe est copiée sur Cellar et référencée par le journal.
    const [attachment] = journal.attachments
    assert.equal(attachment.status, 'stored')
    assert.equal(attachment.mimeType, 'application/pdf')
    const object = await StorageObject.findOrFail(attachment.storageObjectId!)
    assert.equal(object.status, 'ready')
    assert.isTrue(storage.driver.objects.has(object.key))

    assert.lengthOf(events, 1)
    assert.deepEqual(events[0].mail, { inboundMailId: journal.id, rfqSupplierId: recipient.id })
  }).cleanup(() => emitter.clearListeners(InboundMailReceived))

  test('le même mail livré deux fois n’est traité qu’une fois', async ({ client, assert }) => {
    const { address } = await sentRfq()
    inbound.provider.add('mail-1', {
      to: address,
      attachments: [{ filename: 'devis.pdf', content: '%PDF-1.7 devis' }],
    })

    const first = await deliver(client, 'mail-1')
    const replay = await deliver(client, 'mail-1')

    first.assertStatus(200)
    replay.assertStatus(200)
    replay.assertBodyContains({ receipt: 'duplicate' })
    assert.lengthOf(await InboundMail.all(), 1)
    assert.equal(inbound.provider.contentFetches, 1)
    assert.equal(inbound.provider.attachmentFetches, 1)
    assert.lengthOf(storage.driver.puts, 1)
  })

  test('un mail d’absence automatique n’est pas pris pour une réponse', async ({
    client,
    assert,
  }) => {
    const { address, recipient } = await sentRfq()
    let emitted = 0
    emitter.on(InboundMailReceived, () => {
      emitted += 1
    })
    inbound.provider.add('mail-1', {
      to: address,
      subject: 'Réponse automatique : absent du bureau',
      headers: { 'auto-submitted': 'auto-replied' },
      attachments: [{ filename: 'devis.pdf', content: '%PDF-1.7' }],
    })

    const response = await deliver(client, 'mail-1')

    response.assertStatus(200)
    const journal = await InboundMail.query().preload('attachments').firstOrFail()
    assert.equal(journal.status, 'rejected')
    assert.equal(journal.rejectionReason, 'auto_reply')
    assert.equal(journal.rfqSupplierId, recipient.id)
    // Un mail écarté n'est que journalisé : ni corps, ni pièce jointe.
    assert.isNull(journal.textBody)
    assert.lengthOf(journal.attachments, 0)
    assert.lengthOf(storage.driver.puts, 0)
    assert.equal(emitted, 0)
  }).cleanup(() => emitter.clearListeners(InboundMailReceived))

  test('un mail vers une adresse inconnue est journalisé sans erreur', async ({
    client,
    assert,
  }) => {
    inbound.provider.add('mail-1', {
      to: `rfq-${'0'.repeat(32)}@${TEST_RELAY_DOMAIN}`,
    })
    inbound.provider.add('mail-2', { to: `bonjour@${TEST_RELAY_DOMAIN}` })

    const unknownToken = await deliver(client, 'mail-1')
    const notRelay = await deliver(client, 'mail-2')

    unknownToken.assertStatus(200)
    notRelay.assertStatus(200)
    const journal = await InboundMail.query().orderBy('id')
    assert.lengthOf(journal, 2)
    for (const row of journal) {
      assert.equal(row.status, 'rejected')
      assert.equal(row.rejectionReason, 'unknown_address')
      assert.isNull(row.rfqSupplierId)
    }
  })

  test('une signature invalide est refusée et rien n’est journalisé', async ({
    client,
    assert,
  }) => {
    const { address } = await sentRfq()
    inbound.provider.add('mail-1', { to: address })

    const response = await deliver(client, 'mail-1', 'forged')

    response.assertStatus(403)
    assert.lengthOf(await InboundMail.all(), 0)
    assert.equal(inbound.provider.contentFetches, 0)
  })

  test('l’adresse reste valide pendant le délai de grâce, puis expire', async ({
    client,
    assert,
  }) => {
    const recent = await sentRfq('expired')
    const old = await sentRfq('expired')
    await old.rfq.merge({ expiredAt: DateTime.now().minus({ days: 31 }) }).save()
    inbound.provider.add('mail-recent', { to: recent.address })
    inbound.provider.add('mail-old', { to: old.address })

    await deliver(client, 'mail-recent')
    await deliver(client, 'mail-old')

    const accepted = await InboundMail.findByOrFail('providerMessageId', 'mail-recent')
    const expired = await InboundMail.findByOrFail('providerMessageId', 'mail-old')
    assert.equal(accepted.status, 'processed')
    assert.equal(expired.status, 'rejected')
    assert.equal(expired.rejectionReason, 'expired_address')
    assert.equal(expired.rfqSupplierId, old.recipient.id)
  })

  test('une boucle et un mail trop volumineux sont écartés', async ({ client, assert }) => {
    const { address } = await sentRfq()
    inbound.provider.add('mail-loop', { to: address, from: `rfq-abc@${TEST_RELAY_DOMAIN}` })
    inbound.provider.add('mail-big', { to: address, sizeBytes: 200 * 1024 * 1024 })

    await deliver(client, 'mail-loop')
    await deliver(client, 'mail-big')

    const loop = await InboundMail.findByOrFail('providerMessageId', 'mail-loop')
    const big = await InboundMail.findByOrFail('providerMessageId', 'mail-big')
    assert.equal(loop.rejectionReason, 'loop')
    assert.equal(big.rejectionReason, 'too_large')
  })

  test('une pièce jointe refusée n’écarte pas le mail', async ({ client, assert }) => {
    const { address } = await sentRfq()
    inbound.provider.add('mail-1', {
      to: address,
      from: 'inconnu@ailleurs.test',
      attachments: [
        { filename: 'devis.pdf', content: '%PDF-1.7 devis' },
        { filename: 'outil.exe', content: 'MZ' },
        { filename: 'logo.png', content: 'png', inline: true },
        // Sous la limite du mail (25 Mo), au-dessus de celle d'une pièce (15 Mo).
        { filename: 'catalogue.pdf', sizeBytes: 20 * 1024 * 1024 },
      ],
    })

    await deliver(client, 'mail-1')

    const journal = await InboundMail.query()
      .preload('attachments', (attachments) => attachments.orderBy('id'))
      .firstOrFail()
    assert.equal(journal.status, 'processed')
    assert.isFalse(journal.senderKnown)
    assert.deepEqual(
      journal.attachments.map((a) => [a.filename, a.status]),
      [
        ['devis.pdf', 'stored'],
        ['outil.exe', 'rejected_type'],
        ['logo.png', 'ignored_inline'],
        ['catalogue.pdf', 'rejected_size'],
      ]
    )
    assert.lengthOf(storage.driver.puts, 1)
  })

  test('un prestataire indisponible laisse le mail rejouable', async ({ assert }) => {
    // Appel direct du service : en test la file est synchrone et rejouerait le
    // job en attendant son backoff.
    const { address, recipient } = await sentRfq()
    const journal = await InboundMailFactory.merge({
      providerMessageId: inbound.provider.add('mail-1', { to: address }),
      recipient: address,
    }).create()
    const inboundMails = await app.container.make(InboundMailService)
    inbound.provider.failure = new Error('Resend indisponible')

    await assert.rejects(() => inboundMails.process(journal.id), 'Resend indisponible')
    await journal.refresh()
    assert.equal(journal.status, 'failed')
    assert.equal(journal.error, 'Resend indisponible')

    // Le prestataire répond de nouveau : la relance du job aboutit.
    inbound.provider.failure = null
    await inboundMails.process(journal.id)
    await journal.refresh()
    assert.equal(journal.status, 'processed')
    assert.equal(journal.rfqSupplierId, recipient.id)
    assert.isNull(journal.error)

    // Un mail déjà traité n'est jamais repris.
    await inboundMails.process(journal.id)
    assert.equal(inbound.provider.contentFetches, 2)
  })
})

test.group('Mails entrants — Reply-To des mails de demande', (group) => {
  useDatabase(group)
  useFakeInboundMail(group)

  test('le mail de demande porte l’adresse relais du couple en Reply-To', async ({
    client,
    assert,
  }) => {
    const buyer = await OrganizationFactory.create()
    const owner = await createMember(buyer, 'owner')
    const supplier = await OrganizationFactory.apply('supplier').create()
    await createMember(supplier, 'owner')
    await createMember(supplier, 'manager')
    const rfq = await RfqFactory.merge({ buyerOrganizationId: buyer.id }).create()
    await RfqItemFactory.merge({ rfqId: rfq.id }).create()
    const pending = await RfqSupplierFactory.merge({
      rfqId: rfq.id,
      supplierOrganizationId: supplier.id,
    }).create()
    const { replyToken } = await RfqSupplier.findOrFail(pending.id)

    await client.post(`/fr/rfqs/${rfq.id}/publish`).withInertia().withCsrfToken().loginAs(owner)
    const { mails } = mail.fake()
    await client.post(`/fr/rfqs/${rfq.id}/send`).withInertia().withCsrfToken().loginAs(owner)
    const sent = mails.sent((mailer) => mailer instanceof RfqReceivedNotification)
    mail.restore()

    // Deux boîtes chez le fournisseur, une seule adresse relais.
    assert.lengthOf(sent, 2)
    for (const mailer of sent) {
      await mailer.buildWithContents()
      const message = mailer.message.toJSON().message
      assert.deepEqual(message.replyTo, [`rfq-${replyToken}@${TEST_RELAY_DOMAIN}`])
      assert.equal(
        (message.headers as Record<string, string>)['X-Auto-Response-Suppress'],
        'OOF, AutoReply'
      )
    }
  })
})
