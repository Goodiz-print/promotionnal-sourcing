import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import mail from '@adonisjs/mail/services/main'
import { UserFactory } from '#database/factories/user_factory'
import { InboundMailFactory } from '#database/factories/inbound_mail_factory'
import InboundMailProcessingFailed from '#events/inbound_mail_processing_failed'
import OnInboundMailProcessingFailed from '#listeners/on_inbound_mail_processing_failed'
import InboundMailFailedAlert from '#mails/inbound_mail_failed_alert'
import AdminAuditLog from '#models/admin_audit_log'
import InboundMail from '#models/inbound_mail'
import Message from '#models/message'
import QuoteDocument from '#models/quote_document'
import InboundMailService from '#services/inbound_mail_service'
import type {
  AdminInboundMailDetail,
  AdminInboundMailOverview,
  AdminInboundMailRecipient,
  AdminInboundMailRow,
} from '#shared/types/admin_inbound_mail'
import type { Paginated } from '#shared/types/pagination'
import { TEST_RELAY_DOMAIN, deliver, sentRfq, useFakeInboundMail } from '#tests/utils/inbound_mail'
import { pdfBuffer, useFakeGhostscript } from '#tests/utils/pdf'
import { useDatabase } from '#tests/utils/setup'
import { useFakeStorage } from '#tests/utils/storage'

/**
 * Supervision des mails entrants (#227). `QUEUE_DRIVER=sync` en test : un mail
 * livré au webhook est traité dans la requête.
 */
interface AdminPost {
  user: unknown
  url: string
  body?: object
}

function post(client: ApiClient, { user, url, body = {} }: AdminPost) {
  return client
    .post(url)
    .json(body)
    .redirects(0)
    .withCsrfToken()
    .header('Accept', 'application/json')
    .loginAs(user as never)
}

const QUOTE_PDF = pdfBuffer(200).toString()
const UNKNOWN_ADDRESS = `rfq-${'0'.repeat(32)}@${TEST_RELAY_DOMAIN}`

test.group('Admin — supervision des mails entrants', (group) => {
  useDatabase(group)
  const inbound = useFakeInboundMail(group)
  useFakeStorage(group)
  useFakeGhostscript(group, { available: false })

  /** Réponse avec devis PDF envoyée à une adresse relais inconnue : écartée. */
  async function unattachedReply(client: ApiClient) {
    inbound.provider.add('lost-1', {
      to: UNKNOWN_ADDRESS,
      from: 'Contact <contact@fournisseur.test>',
      text: 'Voici notre devis.',
      attachments: [{ filename: 'devis.pdf', content: QUOTE_PDF }],
    })
    await deliver(client, 'lost-1')
    return InboundMail.query().where('providerMessageId', 'lost-1').firstOrFail()
  }

  test('refuse l’accès et les actions à qui n’est pas admin', async ({ client, assert }) => {
    const { recipient } = await sentRfq()
    const journal = await InboundMailFactory.merge({ status: 'failed' }).create()

    const base = `/fr/admin/inbound-mail/${journal.id}`
    const users = await Promise.all(
      (['platformModerator', 'platformSupport', 'platformAnalyst'] as const).map((state) =>
        UserFactory.apply(state).create()
      )
    )
    const responses = await Promise.all(
      users.flatMap((user) => [
        client.get('/fr/admin/inbound-mail').withInertia().loginAs(user),
        client.get(base).withInertia().loginAs(user),
        post(client, { user, url: `${base}/attach`, body: { rfqSupplierId: recipient.id } }),
        post(client, { user, url: `${base}/replay` }),
        post(client, { user, url: `${base}/dismiss` }),
      ])
    )
    responses.forEach((response) => response.assertStatus(403))

    await journal.refresh()
    assert.equal(journal.status, 'failed')
    assert.isNull(journal.rfqSupplierId)
    assert.lengthOf(await AdminAuditLog.query().whereILike('action', 'inbound_mail.%'), 0)
  })

  test('liste les mails, filtre par état et compte chaque état', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await InboundMailFactory.merge({ status: 'processed' }).create()
    const failed = await InboundMailFactory.merge({
      status: 'failed',
      error: 'HTTP 502\nstack',
    }).create()
    await InboundMailFactory.merge({ status: 'rejected', rejectionReason: 'auto_reply' }).create()

    const all = await client.get('/fr/admin/inbound-mail').withInertia().loginAs(admin)
    all.assertStatus(200)
    const overview = all.inertiaProps.overview as AdminInboundMailOverview
    assert.deepEqual(overview, {
      received: 0,
      processing: 0,
      processed: 1,
      rejected: 1,
      failed: 1,
    })
    assert.lengthOf((all.inertiaProps.mails as Paginated<AdminInboundMailRow>).data, 3)

    const filtered = await client
      .get('/fr/admin/inbound-mail?status=failed')
      .withInertia()
      .loginAs(admin)
    const rows = (filtered.inertiaProps.mails as Paginated<AdminInboundMailRow>).data
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].id, failed.id)
    assert.equal(rows[0].error, 'HTTP 502')
    assert.isTrue(rows[0].replayable)
    assert.isTrue(rows[0].dismissable)

    const byReason = await client
      .get('/fr/admin/inbound-mail?rejection=auto_reply')
      .withInertia()
      .loginAs(admin)
    assert.lengthOf((byReason.inertiaProps.mails as Paginated<AdminInboundMailRow>).data, 1)
  })

  test('la fiche propose les demandes des fournisseurs du domaine de l’expéditeur', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { recipient, rfq } = await sentRfq()
    const journal = await unattachedReply(client)

    const response = await client
      .get(`/fr/admin/inbound-mail/${journal.id}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const detail = response.inertiaProps.mail as AdminInboundMailDetail
    assert.equal(detail.status, 'rejected')
    assert.equal(detail.rejectionReason, 'unknown_address')
    assert.isTrue(detail.attachable)
    const candidates = response.inertiaProps.candidates as AdminInboundMailRecipient[]
    assert.deepEqual(
      candidates.map((candidate) => candidate.rfqSupplierId),
      [recipient.id]
    )
    assert.equal(candidates[0].rfqId, rfq.id)

    const missing = await client.get('/fr/admin/inbound-mail/999999').withInertia().loginAs(admin)
    missing.assertStatus(404)
  })

  test('un admin rattache un mail non rattaché à la bonne demande', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { recipient } = await sentRfq()
    const journal = await unattachedReply(client)
    assert.equal(journal.status, 'rejected')
    assert.lengthOf(await Message.all(), 0)

    const response = await post(client, {
      user: admin,
      url: `/fr/admin/inbound-mail/${journal.id}/attach`,
      body: {
        rfqSupplierId: recipient.id,
      },
    })

    response.assertStatus(302)
    await journal.refresh()
    assert.equal(journal.status, 'processed')
    assert.isNull(journal.rejectionReason)
    assert.equal(journal.rfqSupplierId, recipient.id)
    assert.isNotNull(journal.attachedManuallyAt)

    // La réponse est enregistrée comme pour un mail rattaché par son adresse.
    const message = await Message.query().where('inboundMailId', journal.id).firstOrFail()
    assert.equal(message.body, 'Voici notre devis.')
    assert.lengthOf(await QuoteDocument.query().where('rfqSupplierId', recipient.id), 1)

    const audit = await AdminAuditLog.query().where('action', 'inbound_mail.attached').firstOrFail()
    assert.equal(audit.targetType, 'inbound_mail')
    assert.equal(audit.targetId, journal.id)
    assert.equal(audit.actorUserId, admin.id)
    assert.deepEqual(audit.changes, {
      before: { status: 'rejected', rfqSupplierId: null },
      after: { status: 'received', rfqSupplierId: recipient.id },
    })
  })

  test('un mail traité ne peut plus être rattaché ailleurs', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { address, recipient } = await sentRfq()
    const other = await sentRfq()
    inbound.provider.add('mail-1', { to: address })
    await deliver(client, 'mail-1')
    const journal = await InboundMail.findByOrFail('providerMessageId', 'mail-1')

    await post(client, {
      user: admin,
      url: `/fr/admin/inbound-mail/${journal.id}/attach`,
      body: {
        rfqSupplierId: other.recipient.id,
      },
    })

    await journal.refresh()
    assert.equal(journal.rfqSupplierId, recipient.id)
    assert.isNull(journal.attachedManuallyAt)
    assert.lengthOf(await AdminAuditLog.query().where('action', 'inbound_mail.attached'), 0)
  })

  test('rattacher à un couple demande / fournisseur inexistant est refusé', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const journal = await InboundMailFactory.merge({ status: 'failed' }).create()

    const response = await post(client, {
      user: admin,
      url: `/fr/admin/inbound-mail/${journal.id}/attach`,
      body: {
        rfqSupplierId: 999999,
      },
    })

    response.assertStatus(422)
    await journal.refresh()
    assert.isNull(journal.rfqSupplierId)
  })

  test('le rejeu d’un mail déjà traité ne crée pas de doublon', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { address, recipient } = await sentRfq()
    inbound.provider.add('mail-1', {
      to: address,
      attachments: [{ filename: 'devis.pdf', content: QUOTE_PDF }],
    })
    await deliver(client, 'mail-1')
    const journal = await InboundMail.findByOrFail('providerMessageId', 'mail-1')
    assert.equal(journal.status, 'processed')
    const fetches = inbound.provider.contentFetches

    const first = await post(client, {
      user: admin,
      url: `/fr/admin/inbound-mail/${journal.id}/replay`,
    })
    const second = await post(client, {
      user: admin,
      url: `/fr/admin/inbound-mail/${journal.id}/replay`,
    })

    first.assertStatus(302)
    second.assertStatus(302)
    await journal.refresh()
    assert.equal(journal.status, 'processed')
    assert.equal(inbound.provider.contentFetches, fetches)
    assert.lengthOf(await Message.query().where('inboundMailId', journal.id), 1)
    assert.lengthOf(await QuoteDocument.query().where('rfqSupplierId', recipient.id), 1)
    assert.lengthOf(await AdminAuditLog.query().where('action', 'inbound_mail.replayed'), 2)
  })

  test('le rejeu d’un mail en échec le traite une fois le prestataire revenu', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { address, recipient } = await sentRfq()
    inbound.provider.add('mail-1', { to: address, text: 'Notre réponse.' })
    const journal = await InboundMailFactory.merge({
      providerMessageId: 'mail-1',
      recipient: address,
    }).create()
    inbound.provider.failure = new Error('provider down')
    const inboundMails = await app.container.make(InboundMailService)
    await assert.rejects(() => inboundMails.process(journal.id), 'provider down')
    await journal.refresh()
    assert.equal(journal.status, 'failed')

    inbound.provider.failure = null
    const response = await post(client, {
      user: admin,
      url: `/fr/admin/inbound-mail/${journal.id}/replay`,
    })

    response.assertStatus(302)
    await journal.refresh()
    assert.equal(journal.status, 'processed')
    assert.isNull(journal.error)
    assert.equal(journal.rfqSupplierId, recipient.id)
    assert.lengthOf(await Message.query().where('inboundMailId', journal.id), 1)
  })

  test('un admin écarte un mail en échec, qui n’est plus repris', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const journal = await InboundMailFactory.merge({
      status: 'failed',
      recipient: UNKNOWN_ADDRESS,
    }).create()

    const response = await post(client, {
      user: admin,
      url: `/fr/admin/inbound-mail/${journal.id}/dismiss`,
    })
    await post(client, { user: admin, url: `/fr/admin/inbound-mail/${journal.id}/dismiss` })

    response.assertStatus(302)
    await journal.refresh()
    assert.equal(journal.status, 'rejected')
    assert.equal(journal.rejectionReason, 'dismissed')
    assert.lengthOf(await AdminAuditLog.query().where('action', 'inbound_mail.dismissed'), 1)
  })
})

test.group('Admin — alerte sur un mail entrant en échec définitif', (group) => {
  useDatabase(group)

  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    return () => mail.restore()
  })

  test('alerte une seule fois par mail, même rejoué par la reprise', async ({ assert }) => {
    const journal = await InboundMailFactory.merge({ status: 'failed' }).create()
    const event = new InboundMailProcessingFailed({
      inboundMailId: journal.id,
      error: 'HTTP 502',
    })
    const listener = new OnInboundMailProcessingFailed('ops@example.com', 'https://app.test')

    await listener.handle(event)
    await listener.handle(event)

    const alerts = fakeMailer.mails.sent((sent) => sent instanceof InboundMailFailedAlert)
    assert.lengthOf(alerts, 1)
    await journal.refresh()
    assert.isNotNull(journal.failureAlertedAt)
  })

  test('sans MAIL_ALERT_ADDRESS : log seul, aucun mail', async ({ assert }) => {
    const journal = await InboundMailFactory.merge({ status: 'failed' }).create()

    await new OnInboundMailProcessingFailed(undefined).handle(
      new InboundMailProcessingFailed({ inboundMailId: journal.id, error: 'HTTP 502' })
    )

    fakeMailer.mails.assertNoneSent()
    await journal.refresh()
    assert.isNull(journal.failureAlertedAt)
  })

  test('un échec de l’alerte ne remonte pas et elle pourra repartir', async ({ assert }) => {
    const journal = await InboundMailFactory.merge({ status: 'failed' }).create()
    fakeMailer.send = async () => {
      throw new Error('smtp down')
    }

    await assert.doesNotReject(() =>
      new OnInboundMailProcessingFailed('ops@example.com').handle(
        new InboundMailProcessingFailed({ inboundMailId: journal.id, error: 'HTTP 502' })
      )
    )
    await journal.refresh()
    assert.isNull(journal.failureAlertedAt)
  })
})
