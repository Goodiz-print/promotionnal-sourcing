import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import { ConversationFactory } from '#database/factories/conversation_factory'
import { MessageFactory } from '#database/factories/message_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqItemFactory } from '#database/factories/rfq_item_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import ExpireRfqsJob from '#jobs/expire_rfqs_job'
import RemindRfqSuppliersJob from '#jobs/remind_rfq_suppliers_job'
import RfqReminderNotification from '#mails/rfq_reminder_notification'
import SupplierReplyReceivedNotification from '#mails/supplier_reply_received_notification'
import Notification from '#models/notification'
import Organization from '#models/organization'
import Rfq from '#models/rfq'
import RfqItem from '#models/rfq_item'
import RfqSupplier from '#models/rfq_supplier'
import RfqService from '#services/rfq_service'
import RfqDeadlineService from '#services/rfq_deadline_service'
import RfqRecipientService from '#services/rfq_recipient_service'
import {
  RfqInvalidDeadlineException,
  RfqNotEditableException,
  RfqNotExpirableException,
  RfqNotExtendableException,
} from '#exceptions/rfq_errors'
import { deliver, sentRfq, useFakeInboundMail } from '#tests/utils/inbound_mail'
import { createMember } from '#tests/utils/organizations'
import { realPdf, useFakeGhostscript } from '#tests/utils/pdf'
import { useDatabase } from '#tests/utils/setup'
import { useFakeStorage } from '#tests/utils/storage'
import type { SupplierReplyReceivedMailData } from '#shared/types/mail'
import type { RfqSupplierStatus } from '#shared/types/rfq'

/**
 * Expiration à l'échéance et prolongation (`RfqDeadlineService`), relance des
 * fournisseurs sans réponse et réponse tardive (`RfqRecipientService`) — #56, #232. Les dates sont posées par rapport à `now` pour ne jamais dépendre de
 * l'heure d'exécution du test.
 */
const PARIS = 'Europe/Paris'
const now = DateTime.fromISO('2026-10-30T10:00:00', { zone: PARIS })

async function buyer() {
  const org = await OrganizationFactory.create()
  return { org, owner: await createMember(org, 'owner') }
}

/** Destinataire au statut donné (sans l'état `sent` de la fabrique, qui l'écraserait). */
async function recipientWith(rfqId: number, status: RfqSupplierStatus) {
  const supplier = await OrganizationFactory.apply('supplier').create()
  return RfqSupplierFactory.merge({
    rfqId,
    supplierOrganizationId: supplier.id,
    status,
    sentAt: DateTime.now().minus({ days: 4 }),
  }).create()
}

/** Le fournisseur a écrit dans le fil de la demande (par mail, sans devis). */
async function supplierWrote(recipient: RfqSupplier, rfq: Rfq) {
  const conversation = await ConversationFactory.merge({
    buyerOrganizationId: rfq.buyerOrganizationId,
    supplierOrganizationId: recipient.supplierOrganizationId,
    rfqId: rfq.id,
    rfqSupplierId: recipient.id,
  }).create()
  await MessageFactory.merge({ conversationId: conversation.id, authorUserId: null }).create()
}

async function publishedRfq(orgId: number, deadline: string | null) {
  return RfqFactory.apply('published')
    .merge({
      buyerOrganizationId: orgId,
      deadline: deadline ? DateTime.fromISO(deadline, { zone: PARIS }) : null,
    })
    .create()
}

test.group('RFQ — expiration à l’échéance', (group) => {
  useDatabase(group)

  test('une demande dont l’échéance est hier passe en expired, ses destinataires sans réponse aussi', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const deadlines = await app.container.make(RfqDeadlineService)
    const rfq = await publishedRfq(org.id, '2026-10-29')
    const [sent, viewed, responded, declined] = await Promise.all(
      (['sent', 'viewed', 'responded', 'declined'] as const).map((status) =>
        recipientWith(rfq.id, status)
      )
    )

    const expired = await deadlines.expireDue(now)

    assert.deepEqual(
      expired.map((row) => row.id),
      [rfq.id]
    )
    await rfq.refresh()
    assert.equal(rfq.status, 'expired')
    assert.isNotNull(rfq.expiredAt)
    await Promise.all([sent, viewed, responded, declined].map((row) => row.refresh()))
    assert.deepEqual(
      [sent, viewed, responded, declined].map(({ status, expiredFrom }) => [status, expiredFrom]),
      [
        ['expired', 'sent'],
        ['expired', 'viewed'],
        ['responded', null],
        ['declined', null],
      ]
    )
  })

  test('les destinataires d’une autre demande ne sont pas touchés', async ({ assert }) => {
    const { org } = await buyer()
    const deadlines = await app.container.make(RfqDeadlineService)
    const due = await publishedRfq(org.id, '2026-10-29')
    const open = await publishedRfq(org.id, '2026-11-29')
    await recipientWith(due.id, 'sent')
    const untouched = await recipientWith(open.id, 'sent')

    await deadlines.expireDue(now)

    await untouched.refresh()
    assert.equal(untouched.status, 'sent')
    assert.isNull(untouched.expiredFrom)
  })

  test('l’échéance du jour laisse toute la journée aux fournisseurs', async ({ assert }) => {
    const { org } = await buyer()
    const deadlines = await app.container.make(RfqDeadlineService)
    const rfq = await publishedRfq(org.id, '2026-10-30')

    const lateEvening = DateTime.fromISO('2026-10-30T23:30:00', { zone: PARIS })
    const nextMorning = DateTime.fromISO('2026-10-31T00:10:00', { zone: PARIS })

    assert.lengthOf(await deadlines.expireDue(lateEvening), 0)
    assert.lengthOf(await deadlines.expireDue(nextMorning), 1)
    await rfq.refresh()
    assert.equal(rfq.status, 'expired')
  })

  test('un brouillon, une demande close ou sans échéance n’expirent jamais', async ({ assert }) => {
    const { org } = await buyer()
    const deadlines = await app.container.make(RfqDeadlineService)
    const draft = await RfqFactory.merge({
      buyerOrganizationId: org.id,
      deadline: DateTime.fromISO('2026-10-01'),
    }).create()
    const closed = await publishedRfq(org.id, '2026-10-01')
    closed.merge({ status: 'closed', closedAt: now })
    await closed.save()
    const open = await publishedRfq(org.id, null)

    assert.lengthOf(await deadlines.expireDue(now), 0)

    await Promise.all([draft.refresh(), closed.refresh(), open.refresh()])
    assert.equal(draft.status, 'draft')
    assert.equal(closed.status, 'closed')
    assert.equal(open.status, 'published')
  })

  test('expire refuse une demande qui n’est pas publiée', async ({ assert }) => {
    const { org } = await buyer()
    const deadlines = await app.container.make(RfqDeadlineService)
    const draft = await RfqFactory.merge({ buyerOrganizationId: org.id }).create()

    await assert.rejects(() => deadlines.expire(draft), RfqNotExpirableException)
  })

  test('une transition concurrente n’est pas écrasée par l’expiration', async ({ assert }) => {
    const { org } = await buyer()
    const deadlines = await app.container.make(RfqDeadlineService)
    const rfq = await publishedRfq(org.id, '2020-01-01')
    const stale = await Rfq.findOrFail(rfq.id)

    // L'acheteur ferme la demande après la lecture du lot par le job.
    await Rfq.query().where('id', rfq.id).update({ status: 'closed' })

    await assert.rejects(() => deadlines.expire(stale), RfqNotExpirableException)
    await rfq.refresh()
    assert.equal(rfq.status, 'closed')
    assert.isNull(rfq.expiredAt)
  })

  test('un fournisseur ne peut plus répondre après l’échéance, même avant le passage du job', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const recipients = await app.container.make(RfqRecipientService)
    const supplier = await OrganizationFactory.apply('supplier').create()
    const rfq = await publishedRfq(org.id, '2020-01-01')
    await RfqSupplierFactory.apply('sent')
      .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id })
      .create()

    await assert.rejects(() => recipients.decline(rfq, supplier.id), RfqNotEditableException)
  })

  test('le job planifié fait expirer les demandes échues et leurs destinataires sans réponse', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const rfq = await publishedRfq(org.id, '2020-01-01')
    const recipient = await recipientWith(rfq.id, 'sent')

    await new ExpireRfqsJob().execute()

    await Promise.all([rfq.refresh(), recipient.refresh()])
    assert.equal(rfq.status, 'expired')
    assert.equal(recipient.status, 'expired')
  })

  test('expire (intervention) fait aussi expirer les destinataires sans réponse', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const deadlines = await app.container.make(RfqDeadlineService)
    const rfq = await publishedRfq(org.id, null)
    const recipient = await recipientWith(rfq.id, 'viewed')

    await deadlines.expire(rfq, now)

    await recipient.refresh()
    assert.equal(recipient.status, 'expired')
    assert.equal(recipient.expiredFrom, 'viewed')
  })

  test('dans la transaction de l’appelant : un rollback annule demande et destinataires', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const deadlines = await app.container.make(RfqDeadlineService)
    const rfq = await publishedRfq(org.id, null)
    const recipient = await recipientWith(rfq.id, 'sent')

    const trx = await db.transaction()
    await deadlines.expire(rfq, now, trx)
    await trx.rollback()

    const [reloaded] = await Promise.all([Rfq.findOrFail(rfq.id), recipient.refresh()])
    assert.equal(reloaded.status, 'published')
    assert.equal(recipient.status, 'sent')
  })

  test('une demande échue refuse nouveaux destinataires, réponse et refus du fournisseur', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const service = await app.container.make(RfqService)
    const recipients = await app.container.make(RfqRecipientService)
    const supplier = await OrganizationFactory.apply('supplier').create()
    const other = await OrganizationFactory.apply('supplier').create()
    const rfq = await RfqFactory.apply('expired').merge({ buyerOrganizationId: org.id }).create()
    await RfqSupplierFactory.apply('sent')
      .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id })
      .create()

    await assert.rejects(() => service.addSuppliers(rfq, [other.id]), RfqNotEditableException)
    await assert.rejects(() => recipients.decline(rfq, supplier.id), RfqNotEditableException)
    await assert.rejects(() => recipients.markResponded(rfq, supplier.id), RfqNotEditableException)
  })
})

test.group('RFQ — prolongation d’échéance', (group) => {
  useDatabase(group)

  test('prolonge une demande publiée sans toucher au besoin', async ({ assert }) => {
    const { org } = await buyer()
    const deadlines = await app.container.make(RfqDeadlineService)
    const rfq = await publishedRfq(org.id, '2026-11-05')
    await RfqItemFactory.merge({ rfqId: rfq.id, name: 'Tote bag', quantity: 100 }).create()

    await deadlines.extendDeadline(rfq, { deadline: '2026-11-20' }, now)

    await rfq.refresh()
    assert.equal(rfq.status, 'published')
    assert.equal(rfq.deadline!.setZone(PARIS).toISODate(), '2026-11-20')
    const [item] = await RfqItem.query().where('rfqId', rfq.id)
    assert.equal(item.name, 'Tote bag')
    assert.equal(item.quantity, 100)
  })

  test('une demande échue est rouverte par la nouvelle échéance', async ({ assert }) => {
    const { org } = await buyer()
    const deadlines = await app.container.make(RfqDeadlineService)
    const rfq = await RfqFactory.apply('expired')
      .merge({ buyerOrganizationId: org.id, deadline: DateTime.fromISO('2026-10-20') })
      .create()

    await deadlines.extendDeadline(rfq, { deadline: '2026-11-15' }, now)

    await rfq.refresh()
    assert.equal(rfq.status, 'published')
    assert.isNull(rfq.expiredAt)
    assert.equal(rfq.deadline!.setZone(PARIS).toISODate(), '2026-11-15')
  })

  test('la réouverture rend à chaque destinataire expiré son statut d’avant', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const deadlines = await app.container.make(RfqDeadlineService)
    const rfq = await publishedRfq(org.id, '2026-10-29')
    const sent = await recipientWith(rfq.id, 'sent')
    const viewed = await recipientWith(rfq.id, 'viewed')
    const declined = await recipientWith(rfq.id, 'declined')
    await deadlines.expireDue(now)
    await rfq.refresh()

    await deadlines.extendDeadline(rfq, { deadline: '2026-11-15' }, now)

    await Promise.all([sent.refresh(), viewed.refresh(), declined.refresh()])
    assert.deepEqual(
      [sent, viewed, declined].map(({ status, expiredFrom }) => [status, expiredFrom]),
      [
        ['sent', null],
        ['viewed', null],
        ['declined', null],
      ]
    )
  })

  test('la prolongation permet une nouvelle relance des silencieux', async ({ assert }) => {
    const { org } = await buyer()
    const deadlines = await app.container.make(RfqDeadlineService)
    const supplier = await OrganizationFactory.apply('supplier').create()
    const rfq = await publishedRfq(org.id, '2026-11-05')
    const recipient = await RfqSupplierFactory.apply('sent')
      .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id, remindedAt: now })
      .create()

    await deadlines.extendDeadline(rfq, { deadline: '2026-11-20' }, now)

    await recipient.refresh()
    assert.isNull(recipient.remindedAt)
  })

  test('refuse une date passée, ou pas postérieure à l’échéance actuelle', async ({ assert }) => {
    const { org } = await buyer()
    const deadlines = await app.container.make(RfqDeadlineService)
    const rfq = await publishedRfq(org.id, '2026-11-10')

    for (const deadline of ['2026-10-01', '2026-11-10', '2026-11-02']) {
      await assert.rejects(
        () => deadlines.extendDeadline(rfq, { deadline }, now),
        RfqInvalidDeadlineException
      )
    }
    await rfq.refresh()
    assert.equal(rfq.deadline!.setZone(PARIS).toISODate(), '2026-11-10')
  })

  test('refuse un brouillon et une demande close', async ({ assert }) => {
    const { org } = await buyer()
    const deadlines = await app.container.make(RfqDeadlineService)
    const draft = await RfqFactory.merge({ buyerOrganizationId: org.id }).create()
    const closed = await publishedRfq(org.id, '2026-11-10')
    closed.merge({ status: 'closed', closedAt: now })
    await closed.save()

    for (const rfq of [draft, closed]) {
      await assert.rejects(
        () => deadlines.extendDeadline(rfq, { deadline: '2026-12-01' }, now),
        RfqNotExtendableException
      )
    }
  })

  test('depuis l’écran : prolonge, rouvre une demande échue, refuse une date antérieure', async ({
    client,
    assert,
  }) => {
    const { org, owner } = await buyer()
    const rfq = await publishedRfq(org.id, '2099-01-10')
    const expired = await RfqFactory.apply('expired')
      .merge({ buyerOrganizationId: org.id, deadline: DateTime.fromISO('2020-01-01') })
      .create()
    const patch = (id: number, deadline: string) =>
      client
        .patch(`/fr/rfqs/${id}/deadline`)
        .withInertia()
        .withCsrfToken()
        .redirects(0)
        .loginAs(owner)
        .json({ deadline })

    const extended = await patch(rfq.id, '2099-02-01')
    const reopened = await patch(expired.id, '2099-03-01')
    const earlier = await patch(rfq.id, '2099-01-15')

    // Inertia convertit la redirection d'un PATCH en 303.
    for (const response of [extended, reopened, earlier]) response.assertStatus(303)
    await Promise.all([rfq.refresh(), expired.refresh()])
    assert.equal(rfq.deadline!.setZone(PARIS).toISODate(), '2099-02-01')
    assert.equal(expired.status, 'published')
    assert.isNull(expired.expiredAt)
  })

  test('un simple membre ne peut pas prolonger', async ({ client, assert }) => {
    const { org } = await buyer()
    const member = await createMember(org, 'member')
    const rfq = await publishedRfq(org.id, '2099-01-10')

    await client
      .patch(`/fr/rfqs/${rfq.id}/deadline`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(member)
      .json({ deadline: '2099-02-01' })

    await rfq.refresh()
    assert.equal(rfq.deadline!.setZone(PARIS).toISODate(), '2099-01-10')
  })

  test('le fournisseur voit une demande échue et ne peut plus la décliner', async ({
    client,
    assert,
  }) => {
    const { org } = await buyer()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const supplierOwner = await createMember(supplier, 'owner')
    const rfq = await RfqFactory.apply('expired').merge({ buyerOrganizationId: org.id }).create()
    await RfqItemFactory.merge({ rfqId: rfq.id }).create()
    await RfqSupplierFactory.apply('sent')
      .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id })
      .create()

    const shown = await client
      .get(`/fr/supplier/rfqs/${rfq.id}`)
      .withInertia()
      .loginAs(supplierOwner)
    await client
      .post(`/fr/supplier/rfqs/${rfq.id}/decline`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(supplierOwner)

    shown.assertStatus(200)
    assert.equal(shown.inertiaProps.rfq.status, 'expired')
    const [recipient] = await RfqSupplier.query().where('rfqId', rfq.id)
    assert.equal(recipient.status, 'viewed')
  })
})

test.group('RfqRecipientService — bascules d’échéance et relance', (group) => {
  useDatabase(group)

  test('expireAwaiting puis restoreExpired : aller-retour, répondus et déclinés intacts', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const recipients = await app.container.make(RfqRecipientService)
    const rfq = await publishedRfq(org.id, null)
    const rows = await Promise.all(
      (['sent', 'viewed', 'responded', 'declined'] as const).map((status) =>
        recipientWith(rfq.id, status)
      )
    )
    const statuses = async () => {
      await Promise.all(rows.map((row) => row.refresh()))
      return rows.map(({ status }) => status)
    }

    await db.transaction((trx) => recipients.expireAwaiting(rfq.id, now, trx))
    const expired = await statuses()
    await db.transaction((trx) => recipients.restoreExpired(rfq.id, now, trx))

    assert.deepEqual(expired, ['expired', 'expired', 'responded', 'declined'])
    assert.deepEqual(await statuses(), ['sent', 'viewed', 'responded', 'declined'])
  })

  test('resetReminders ne rouvre la relance que des destinataires sans réponse', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const recipients = await app.container.make(RfqRecipientService)
    const rfq = await publishedRfq(org.id, null)
    const silent = await recipientWith(rfq.id, 'viewed')
    const replied = await recipientWith(rfq.id, 'sent')
    const responded = await recipientWith(rfq.id, 'responded')
    await supplierWrote(replied, rfq)
    await RfqSupplier.query().where('rfqId', rfq.id).update({ remindedAt: now.toJSDate() })

    await db.transaction((trx) => recipients.resetReminders(rfq.id, trx))

    await Promise.all([silent.refresh(), replied.refresh(), responded.refresh()])
    assert.isNull(silent.remindedAt)
    assert.isNotNull(replied.remindedAt)
    assert.isNotNull(responded.remindedAt)
  })

  test('applyViewed : sent devient viewed, un expiré ne bouge pas', async ({ assert }) => {
    const { org } = await buyer()
    const recipients = await app.container.make(RfqRecipientService)
    const rfq = await publishedRfq(org.id, null)
    const sent = await recipientWith(rfq.id, 'sent')
    const expired = await recipientWith(rfq.id, 'expired')

    await recipients.applyViewed(sent)
    await recipients.applyViewed(expired)

    await Promise.all([sent.refresh(), expired.refresh()])
    assert.equal(sent.status, 'viewed')
    assert.equal(expired.status, 'expired')
  })

  test('markReminded consigne la relance des seules lignes données', async ({ assert }) => {
    const { org } = await buyer()
    const recipients = await app.container.make(RfqRecipientService)
    const rfq = await publishedRfq(org.id, null)
    const reminded = await recipientWith(rfq.id, 'sent')
    const other = await recipientWith(rfq.id, 'sent')

    await recipients.markReminded([reminded], now)
    await recipients.markReminded([], now)

    await Promise.all([reminded.refresh(), other.refresh()])
    assert.equal(reminded.remindedAt!.toMillis(), now.toMillis())
    assert.isNull(other.remindedAt)
  })
})

test.group('RFQ — relance des fournisseurs sans réponse', (group) => {
  useDatabase(group)
  // Adresse relais active : la relance porte le même `Reply-To` que la demande.
  useFakeInboundMail(group)

  async function recipientOf(
    rfqId: number,
    overrides: Partial<{ status: RfqSupplierStatus; sentDaysAgo: number }> = {}
  ) {
    const supplier = await OrganizationFactory.apply('supplier').create()
    const user = await createMember(supplier, 'owner')
    const recipient = await RfqSupplierFactory.merge({
      rfqId,
      supplierOrganizationId: supplier.id,
      status: overrides.status ?? 'sent',
      sentAt: DateTime.now().minus({ days: overrides.sentDaysAgo ?? 4 }),
    }).create()
    return { supplier, user, recipient }
  }

  test('relance un destinataire sans réponse depuis assez longtemps, qu’il ait ouvert ou non', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const recipients = await app.container.make(RfqRecipientService)
    const rfq = await publishedRfq(org.id, null)
    const silent = await recipientOf(rfq.id, { sentDaysAgo: 4 })
    await recipientOf(rfq.id, { sentDaysAgo: 1 })
    const opened = await recipientOf(rfq.id, { status: 'viewed', sentDaysAgo: 10 })

    const due = await recipients.dueForReminder()

    assert.sameMembers(
      due.map((row) => row.supplierOrganizationId),
      [silent.supplier.id, opened.supplier.id]
    )
  })

  test('ne relance ni les répondus, ni les déclinés, ni les expirés', async ({ assert }) => {
    const { org } = await buyer()
    const recipients = await app.container.make(RfqRecipientService)
    const rfq = await publishedRfq(org.id, null)
    await Promise.all(
      (['pending', 'responded', 'declined', 'expired'] as const).map((status) =>
        recipientOf(rfq.id, { status })
      )
    )

    assert.lengthOf(await recipients.dueForReminder(), 0)
  })

  test('un fournisseur qui a répondu par mail sans devis n’est pas relancé', async ({ assert }) => {
    const { org } = await buyer()
    const recipients = await app.container.make(RfqRecipientService)
    const rfq = await publishedRfq(org.id, null)
    const replied = await recipientOf(rfq.id)
    const silent = await recipientOf(rfq.id)
    await supplierWrote(replied.recipient, rfq)

    const due = await recipients.dueForReminder()

    assert.deepEqual(
      due.map(({ id }) => id),
      [silent.recipient.id]
    )
  })

  test('un message de l’agence seule ne compte pas comme une réponse', async ({ assert }) => {
    const { org } = await buyer()
    const recipients = await app.container.make(RfqRecipientService)
    const rfq = await publishedRfq(org.id, null)
    const { recipient } = await recipientOf(rfq.id)
    const conversation = await ConversationFactory.merge({
      buyerOrganizationId: org.id,
      supplierOrganizationId: recipient.supplierOrganizationId,
      rfqId: rfq.id,
      rfqSupplierId: recipient.id,
    }).create()
    await MessageFactory.apply('fromAgency')
      .merge({ conversationId: conversation.id, authorUserId: null })
      .create()

    const due = await recipients.dueForReminder()

    assert.deepEqual(
      due.map(({ id }) => id),
      [recipient.id]
    )
  })

  test('remindableRecipients : sans réponse et jamais relancés, restreint à une demande', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const recipients = await app.container.make(RfqRecipientService)
    const rfq = await publishedRfq(org.id, null)
    const other = await publishedRfq(org.id, null)
    const sent = await recipientOf(rfq.id)
    const viewed = await recipientOf(rfq.id, { status: 'viewed' })
    const replied = await recipientOf(rfq.id, { status: 'viewed' })
    await supplierWrote(replied.recipient, rfq)
    const reminded = await recipientOf(rfq.id)
    await reminded.recipient.merge({ remindedAt: DateTime.now() }).save()
    await recipientOf(rfq.id, { status: 'expired' })
    const elsewhere = await recipientOf(other.id)

    const ofRfq = await recipients.remindableRecipients(rfq.id)
    const all = await recipients.remindableRecipients()

    assert.sameMembers(
      ofRfq.map(({ id }) => id),
      [sent.recipient.id, viewed.recipient.id]
    )
    assert.includeMembers(
      all.map(({ id }) => id),
      [sent.recipient.id, viewed.recipient.id, elsewhere.recipient.id]
    )
    assert.notInclude(
      all.map(({ id }) => id),
      replied.recipient.id
    )
  })

  test('ni demande close ou échue, ni échéance passée, ni destinataire déjà relancé', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const recipients = await app.container.make(RfqRecipientService)
    const closed = await publishedRfq(org.id, null)
    closed.merge({ status: 'closed', closedAt: DateTime.now() })
    await closed.save()
    const expired = await RfqFactory.apply('expired')
      .merge({ buyerOrganizationId: org.id })
      .create()
    const pastDeadline = await publishedRfq(org.id, '2020-01-01')
    const alreadyReminded = await publishedRfq(org.id, null)
    for (const rfq of [closed, expired, pastDeadline, alreadyReminded]) await recipientOf(rfq.id)
    await RfqSupplier.query()
      .where('rfqId', alreadyReminded.id)
      .update({ reminded_at: DateTime.now().toSQL() })

    assert.lengthOf(await recipients.dueForReminder(), 0)
  })

  test('une seule relance par destinataire, dans sa langue', async ({ assert }) => {
    const { org } = await buyer()
    const rfq = await publishedRfq(org.id, '2099-12-31')
    const { user } = await recipientOf(rfq.id)
    await user.merge({ locale: 'en' }).save()

    const { mails } = mail.fake()
    try {
      await new RemindRfqSuppliersJob().execute()
      await new RemindRfqSuppliersJob().execute()

      const sent = mails.sent((mailer) => mailer instanceof RfqReminderNotification)
      assert.lengthOf(sent, 1)
      const fields = sent[0] as unknown as {
        email: string
        locale: string
        data: { rfqPath: string }
      }
      assert.equal(fields.email, user.email)
      assert.equal(fields.locale, 'en')
      assert.equal(fields.data.rfqPath, `/en/supplier/rfqs/${rfq.id}`)
    } finally {
      mail.restore()
    }

    const [recipient] = await RfqSupplier.query().where('rfqId', rfq.id)
    assert.isNotNull(recipient.remindedAt)
  })

  test('une fiche sans compte est relancée une fois, à son adresse, avec le Reply-To relais', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const rfq = await publishedRfq(org.id, '2099-12-31')
    const sheet = await OrganizationFactory.apply('supplier')
      .merge({ email: 'devis@fiche.test' })
      .create()
    await RfqSupplierFactory.merge({
      rfqId: rfq.id,
      supplierOrganizationId: sheet.id,
      status: 'sent',
      sentAt: DateTime.now().minus({ days: 4 }),
    }).create()
    const recipient = await RfqSupplier.findByOrFail('supplierOrganizationId', sheet.id)

    const { mails } = mail.fake()
    try {
      await new RemindRfqSuppliersJob().execute()
      await new RemindRfqSuppliersJob().execute()

      const sent = mails.sent((mailer) => mailer instanceof RfqReminderNotification)
      assert.lengthOf(sent, 1)
      const fields = sent[0] as unknown as { email: string; data: { buyerName: string | null } }
      assert.equal(fields.email, 'devis@fiche.test')
      // Non abonnée : la relance reste anonyme, comme la demande.
      assert.isNull(fields.data.buyerName)
      const { message } = (sent[0] as RfqReminderNotification).message.toJSON()
      assert.lengthOf((message.replyTo ?? []) as string[], 1)
      assert.include(String((message.replyTo as string[])[0]), recipient.replyToken)
    } finally {
      mail.restore()
    }
  })

  test('le job ne relance pas un fournisseur qui a répondu par mail', async ({ assert }) => {
    const { org } = await buyer()
    const rfq = await publishedRfq(org.id, '2099-12-31')
    const { recipient } = await recipientOf(rfq.id)
    await supplierWrote(recipient, rfq)

    const { mails } = mail.fake()
    try {
      await new RemindRfqSuppliersJob().execute()
      assert.lengthOf(
        mails.sent((mailer) => mailer instanceof RfqReminderNotification),
        0
      )
    } finally {
      mail.restore()
    }
    await recipient.refresh()
    assert.isNull(recipient.remindedAt)
  })
})

test.group('RFQ — réponse tardive (#232)', (group) => {
  useDatabase(group)
  const inbound = useFakeInboundMail(group)
  useFakeStorage(group)
  useFakeGhostscript(group, { available: false })

  /** Demande envoyée à un fournisseur, échéance passée, expirée par le job ; l'agence a un responsable. */
  async function expiredScenario() {
    const sent = await sentRfq()
    await sent.rfq.merge({ deadline: DateTime.fromISO('2020-01-01', { zone: PARIS }) }).save()
    const agency = await Organization.findOrFail(sent.rfq.buyerOrganizationId)
    const owner = await createMember(agency, 'owner', { email: 'owner@agence.test' })
    await new ExpireRfqsJob().execute()
    await sent.recipient.refresh()
    return { ...sent, owner }
  }

  function agencyMails(mails: ReturnType<typeof mail.fake>['mails']) {
    return mails
      .sent((mailer) => mailer instanceof SupplierReplyReceivedNotification)
      .map((mailer) => mailer as unknown as { data: SupplierReplyReceivedMailData })
  }

  test('un devis reçu après l’échéance est enregistré, le destinataire répondu et marqué tardif', async ({
    client,
    assert,
  }) => {
    const { recipient, address, owner } = await expiredScenario()
    assert.equal(recipient.status, 'expired')
    inbound.provider.add('mail-late', {
      to: address,
      text: 'Désolé du retard, voici notre devis.',
      attachments: [{ filename: 'devis.pdf', content: await realPdf() }],
    })

    const { mails } = mail.fake()
    try {
      const response = await deliver(client, 'mail-late')
      response.assertStatus(200)

      const [sent] = agencyMails(mails)
      assert.isTrue(sent.data.late)
      assert.lengthOf(sent.data.documents, 1)
    } finally {
      mail.restore()
    }

    await recipient.refresh()
    assert.equal(recipient.status, 'responded')
    assert.isNull(recipient.expiredFrom)
    assert.isNotNull(recipient.lateReplyAt)
    const [notification] = await Notification.query().where('userId', owner.id)
    assert.equal(notification.type, 'rfq.responded')
    assert.isTrue(notification.data.late)
  })

  test('un simple message tardif est signalé sans changer le statut', async ({
    client,
    assert,
  }) => {
    const { recipient, address } = await expiredScenario()
    inbound.provider.add('mail-late', { to: address, text: 'Encore intéressés ?' })

    const { mails } = mail.fake()
    try {
      const response = await deliver(client, 'mail-late')
      response.assertStatus(200)
      assert.isTrue(agencyMails(mails)[0].data.late)
    } finally {
      mail.restore()
    }

    await recipient.refresh()
    assert.equal(recipient.status, 'expired')
    assert.isNotNull(recipient.lateReplyAt)
  })

  test('un mail reçu avant minuit, traité après l’expiration, n’est pas tardif', async ({
    client,
    assert,
  }) => {
    // Échéance hier : le mail est arrivé hier à 23:55, mais n'est traité
    // qu'aujourd'hui (reprise des mails, rejeu admin), après le job d'expiration.
    const yesterday = DateTime.now().setZone(PARIS).minus({ days: 1 })
    const sent = await sentRfq()
    await sent.rfq.merge({ deadline: yesterday.startOf('day') }).save()
    await new ExpireRfqsJob().execute()
    await sent.recipient.refresh()
    assert.equal(sent.recipient.status, 'expired')
    inbound.provider.add('mail-night', {
      to: sent.address,
      receivedAt: yesterday.set({ hour: 23, minute: 55 }).toISO()!,
      attachments: [{ filename: 'devis.pdf', content: await realPdf() }],
    })

    const { mails } = mail.fake()
    try {
      const response = await deliver(client, 'mail-night')
      response.assertStatus(200)
      agencyMails(mails).forEach(({ data }) => assert.isFalse(data.late))
    } finally {
      mail.restore()
    }

    await sent.recipient.refresh()
    assert.equal(sent.recipient.status, 'responded')
    assert.isNull(sent.recipient.lateReplyAt)
  })

  test('une réponse dans les temps n’est pas tardive', async ({ client, assert }) => {
    const { recipient, address } = await sentRfq()
    inbound.provider.add('mail-1', {
      to: address,
      attachments: [{ filename: 'devis.pdf', content: await realPdf() }],
    })

    const { mails } = mail.fake()
    try {
      const response = await deliver(client, 'mail-1')
      response.assertStatus(200)
      agencyMails(mails).forEach(({ data }) => assert.isFalse(data.late))
    } finally {
      mail.restore()
    }

    await recipient.refresh()
    assert.equal(recipient.status, 'responded')
    assert.isNull(recipient.lateReplyAt)
  })

  test('markLateReply : date la première réponse tardive seulement, à son heure de réception', async ({
    assert,
  }) => {
    const recipients = await app.container.make(RfqRecipientService)
    const { recipient } = await expiredScenario()
    await recipient.load('rfq')
    const first = DateTime.fromISO('2026-11-01T10:00:00', { zone: PARIS })
    const second = first.plus({ days: 2 })

    const results = await db.transaction(async (trx) => [
      await recipients.markLateReply(recipient, trx, first),
      await recipients.markLateReply(recipient, trx, second),
    ])

    assert.deepEqual(results, [true, true])
    await recipient.refresh()
    assert.equal(recipient.lateReplyAt!.toMillis(), first.toMillis())
  })

  test('markLateReply : ni dans les temps, ni pour une demande close', async ({ assert }) => {
    const recipients = await app.container.make(RfqRecipientService)
    const { recipient, rfq } = await sentRfq()
    await recipient.load('rfq')

    const onTime = await db.transaction((trx) => recipients.markLateReply(recipient, trx, now))
    await rfq.merge({ status: 'closed', closedAt: now }).save()
    await recipient.load('rfq')
    const afterClosing = await db.transaction((trx) =>
      recipients.markLateReply(recipient, trx, now)
    )

    assert.isFalse(onTime)
    assert.isFalse(afterClosing)
    await recipient.refresh()
    assert.isNull(recipient.lateReplyAt)
  })

  test('markRespondedByMail : accepte un expiré, refuse une demande close', async ({ assert }) => {
    const recipients = await app.container.make(RfqRecipientService)
    const expired = await expiredScenario()
    await expired.recipient.load('rfq')
    const closed = await sentRfq()
    await closed.rfq.merge({ status: 'closed', closedAt: now }).save()
    await closed.recipient.load('rfq')

    const [fromExpired, fromClosed] = await db.transaction(async (trx) => [
      await recipients.markRespondedByMail(expired.recipient, trx),
      await recipients.markRespondedByMail(closed.recipient, trx),
    ])

    assert.isTrue(fromExpired)
    assert.isFalse(fromClosed)
  })

  test('l’agence et le fournisseur voient le statut expiré puis la réponse tardive', async ({
    client,
    assert,
  }) => {
    const { rfq, supplier, recipient, owner } = await expiredScenario()
    const supplierOwner = await createMember(supplier, 'owner')

    const supplierView = await client
      .get(`/fr/supplier/rfqs/${rfq.id}`)
      .withInertia()
      .loginAs(supplierOwner)
    supplierView.assertStatus(200)
    assert.equal(supplierView.inertiaProps.rfq.myStatus, 'expired')
    assert.isFalse(supplierView.inertiaProps.rfq.myLateReply)

    await recipient.merge({ status: 'responded', lateReplyAt: DateTime.now() }).save()

    const agencyView = await client.get(`/fr/rfqs/${rfq.id}`).withInertia().loginAs(owner)
    const list = await client.get('/fr/supplier/rfqs').withInertia().loginAs(supplierOwner)
    agencyView.assertStatus(200)
    const [row] = agencyView.inertiaProps.rfq.suppliers
    assert.equal(row.status, 'responded')
    assert.isTrue(row.lateReply)
    assert.isTrue(list.inertiaProps.rfqs[0].myLateReply)
  })
})
