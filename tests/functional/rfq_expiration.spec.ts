import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import mail from '@adonisjs/mail/services/main'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqItemFactory } from '#database/factories/rfq_item_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import ExpireRfqsJob from '#jobs/expire_rfqs_job'
import RemindRfqSuppliersJob from '#jobs/remind_rfq_suppliers_job'
import RfqReminderNotification from '#mails/rfq_reminder_notification'
import RfqItem from '#models/rfq_item'
import RfqSupplier from '#models/rfq_supplier'
import RfqService from '#services/rfq_service'
import {
  RfqInvalidDeadlineException,
  RfqNotEditableException,
  RfqNotExpirableException,
  RfqNotExtendableException,
} from '#exceptions/rfq_errors'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

/**
 * Expiration à l'échéance, prolongation et relance des fournisseurs silencieux
 * (#56). Les dates sont posées par rapport à `now` pour ne jamais dépendre de
 * l'heure d'exécution du test.
 */
const PARIS = 'Europe/Paris'
const now = DateTime.fromISO('2026-10-30T10:00:00', { zone: PARIS })

async function buyer() {
  const org = await OrganizationFactory.create()
  return { org, owner: await createMember(org, 'owner') }
}

async function publishedRfq(orgId: number, deadline: string | null) {
  return RfqFactory.apply('published')
    .merge({
      buyerOrganizationId: orgId,
      deadline: deadline ? DateTime.fromISO(deadline) : null,
    })
    .create()
}

test.group('RFQ — expiration à l’échéance', (group) => {
  useDatabase(group)

  test('une demande dont l’échéance est hier passe en expired, ses destinataires gardent leur statut', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const service = await app.container.make(RfqService)
    const rfq = await publishedRfq(org.id, '2026-10-29')
    const viewed = await OrganizationFactory.apply('supplier').create()
    await RfqSupplierFactory.apply('sent')
      .merge({ rfqId: rfq.id, supplierOrganizationId: viewed.id, status: 'viewed' })
      .create()

    const expired = await service.expireDue(now)

    assert.deepEqual(
      expired.map((row) => row.id),
      [rfq.id]
    )
    await rfq.refresh()
    assert.equal(rfq.status, 'expired')
    assert.isNotNull(rfq.expiredAt)
    const [recipient] = await RfqSupplier.query().where('rfqId', rfq.id)
    assert.equal(recipient.status, 'viewed')
  })

  test('l’échéance du jour laisse toute la journée aux fournisseurs', async ({ assert }) => {
    const { org } = await buyer()
    const service = await app.container.make(RfqService)
    const rfq = await publishedRfq(org.id, '2026-10-30')

    const lateEvening = DateTime.fromISO('2026-10-30T23:30:00', { zone: PARIS })
    const nextMorning = DateTime.fromISO('2026-10-31T00:10:00', { zone: PARIS })

    assert.lengthOf(await service.expireDue(lateEvening), 0)
    assert.lengthOf(await service.expireDue(nextMorning), 1)
    await rfq.refresh()
    assert.equal(rfq.status, 'expired')
  })

  test('un brouillon, une demande close ou sans échéance n’expirent jamais', async ({ assert }) => {
    const { org } = await buyer()
    const service = await app.container.make(RfqService)
    const draft = await RfqFactory.merge({
      buyerOrganizationId: org.id,
      deadline: DateTime.fromISO('2026-10-01'),
    }).create()
    const closed = await publishedRfq(org.id, '2026-10-01')
    closed.merge({ status: 'closed', closedAt: now })
    await closed.save()
    const open = await publishedRfq(org.id, null)

    assert.lengthOf(await service.expireDue(now), 0)

    await Promise.all([draft.refresh(), closed.refresh(), open.refresh()])
    assert.equal(draft.status, 'draft')
    assert.equal(closed.status, 'closed')
    assert.equal(open.status, 'published')
  })

  test('expire refuse une demande qui n’est pas publiée', async ({ assert }) => {
    const { org } = await buyer()
    const service = await app.container.make(RfqService)
    const draft = await RfqFactory.merge({ buyerOrganizationId: org.id }).create()

    await assert.rejects(() => service.expire(draft), RfqNotExpirableException)
  })

  test('le job planifié fait expirer les demandes échues', async ({ assert }) => {
    const { org } = await buyer()
    const rfq = await publishedRfq(org.id, '2020-01-01')

    await new ExpireRfqsJob().execute()

    await rfq.refresh()
    assert.equal(rfq.status, 'expired')
  })

  test('une demande échue refuse nouveaux destinataires, réponse et refus du fournisseur', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const service = await app.container.make(RfqService)
    const supplier = await OrganizationFactory.apply('supplier').create()
    const other = await OrganizationFactory.apply('supplier').create()
    const rfq = await RfqFactory.apply('expired').merge({ buyerOrganizationId: org.id }).create()
    await RfqSupplierFactory.apply('sent')
      .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id })
      .create()

    await assert.rejects(() => service.addSuppliers(rfq, [other.id]), RfqNotEditableException)
    await assert.rejects(() => service.decline(rfq, supplier.id), RfqNotEditableException)
    await assert.rejects(() => service.markResponded(rfq, supplier.id), RfqNotEditableException)
  })
})

test.group('RFQ — prolongation d’échéance', (group) => {
  useDatabase(group)

  test('prolonge une demande publiée sans toucher au besoin', async ({ assert }) => {
    const { org } = await buyer()
    const service = await app.container.make(RfqService)
    const rfq = await publishedRfq(org.id, '2026-11-05')
    await RfqItemFactory.merge({ rfqId: rfq.id, name: 'Tote bag', quantity: 100 }).create()

    await service.extendDeadline(rfq, { deadline: '2026-11-20' }, now)

    await rfq.refresh()
    assert.equal(rfq.status, 'published')
    assert.equal(rfq.deadline!.toISODate(), '2026-11-20')
    const [item] = await RfqItem.query().where('rfqId', rfq.id)
    assert.equal(item.name, 'Tote bag')
    assert.equal(item.quantity, 100)
  })

  test('une demande échue est rouverte par la nouvelle échéance', async ({ assert }) => {
    const { org } = await buyer()
    const service = await app.container.make(RfqService)
    const rfq = await RfqFactory.apply('expired')
      .merge({ buyerOrganizationId: org.id, deadline: DateTime.fromISO('2026-10-20') })
      .create()

    await service.extendDeadline(rfq, { deadline: '2026-11-15' }, now)

    await rfq.refresh()
    assert.equal(rfq.status, 'published')
    assert.isNull(rfq.expiredAt)
    assert.equal(rfq.deadline!.toISODate(), '2026-11-15')
  })

  test('refuse une date passée, ou pas postérieure à l’échéance actuelle', async ({ assert }) => {
    const { org } = await buyer()
    const service = await app.container.make(RfqService)
    const rfq = await publishedRfq(org.id, '2026-11-10')

    for (const deadline of ['2026-10-01', '2026-11-10', '2026-11-02']) {
      await assert.rejects(
        () => service.extendDeadline(rfq, { deadline }, now),
        RfqInvalidDeadlineException
      )
    }
    await rfq.refresh()
    assert.equal(rfq.deadline!.toISODate(), '2026-11-10')
  })

  test('refuse un brouillon et une demande close', async ({ assert }) => {
    const { org } = await buyer()
    const service = await app.container.make(RfqService)
    const draft = await RfqFactory.merge({ buyerOrganizationId: org.id }).create()
    const closed = await publishedRfq(org.id, '2026-11-10')
    closed.merge({ status: 'closed', closedAt: now })
    await closed.save()

    for (const rfq of [draft, closed]) {
      await assert.rejects(
        () => service.extendDeadline(rfq, { deadline: '2026-12-01' }, now),
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
    assert.equal(rfq.deadline!.toISODate(), '2099-02-01')
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
    assert.equal(rfq.deadline!.toISODate(), '2099-01-10')
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

test.group('RFQ — relance des fournisseurs silencieux', (group) => {
  useDatabase(group)

  async function recipientOf(
    rfqId: number,
    overrides: Partial<{ status: 'sent' | 'viewed'; sentDaysAgo: number }> = {}
  ) {
    const supplier = await OrganizationFactory.apply('supplier').create()
    const user = await createMember(supplier, 'owner')
    await RfqSupplierFactory.merge({
      rfqId,
      supplierOrganizationId: supplier.id,
      status: overrides.status ?? 'sent',
      sentAt: DateTime.now().minus({ days: overrides.sentDaysAgo ?? 4 }),
    }).create()
    return { supplier, user }
  }

  test('relance un destinataire resté sans ouvrir la demande depuis assez longtemps', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const service = await app.container.make(RfqService)
    const rfq = await publishedRfq(org.id, null)
    const silent = await recipientOf(rfq.id, { sentDaysAgo: 4 })
    await recipientOf(rfq.id, { sentDaysAgo: 1 })
    await recipientOf(rfq.id, { status: 'viewed', sentDaysAgo: 10 })

    const due = await service.dueForReminder()

    assert.deepEqual(
      due.map((row) => row.supplierOrganizationId),
      [silent.supplier.id]
    )
  })

  test('ni demande close ou échue, ni échéance passée, ni destinataire déjà relancé', async ({
    assert,
  }) => {
    const { org } = await buyer()
    const service = await app.container.make(RfqService)
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

    assert.lengthOf(await service.dueForReminder(), 0)
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
      const fields = sent[0] as unknown as { email: string; locale: string; rfqPath: string }
      assert.equal(fields.email, user.email)
      assert.equal(fields.locale, 'en')
      assert.equal(fields.rfqPath, `/en/supplier/rfqs/${rfq.id}`)
    } finally {
      mail.restore()
    }

    const [recipient] = await RfqSupplier.query().where('rfqId', rfq.id)
    assert.isNotNull(recipient.remindedAt)
  })
})
