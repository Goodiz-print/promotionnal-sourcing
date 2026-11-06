import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { StorageObjectFactory } from '#database/factories/storage_object_factory'
import AdminAuditLog from '#models/admin_audit_log'
import OrganizationInvitationNotification from '#mails/organization_invitation_notification'
import { useDatabase } from '#tests/utils/setup'
import { useFakeStorage } from '#tests/utils/storage'
import {
  MAIL_IN_PROGRESS_MINUTES,
  type AdminMailDetail,
  type AdminMailOverview,
  type AdminMailRow,
  type AdminStorageOverview,
} from '#shared/types/admin_ops'
import { MAIL_KINDS, type SendMailPayload } from '#shared/types/mail'

/**
 * Supervision des emails en échec et du stockage Cellar (#178). `QUEUE_DRIVER=sync`
 * en test : un mail rejoué est donc envoyé (au faux mailer) dans la requête.
 */
function post(client: any, user: unknown, url: string, body: object = {}) {
  return client
    .post(url)
    .json(body)
    .redirects(0)
    .withCsrfToken()
    .header('Accept', 'application/json')
    .loginAs(user)
}

const minutesAgo = (minutes: number) => DateTime.now().minus({ minutes }).toJSDate()
const SETTLED = minutesAgo(MAIL_IN_PROGRESS_MINUTES + 10)

function invitation(key: string): SendMailPayload {
  return {
    idempotencyKey: key,
    kind: MAIL_KINDS.organizationInvitation,
    to: `${key}@example.test`,
    locale: 'fr',
    data: { organizationName: 'Acme', roleName: 'Membre', inviterName: 'Owner', acceptUrl: 'u' },
  }
}

async function delivery(
  key: string,
  fields: Record<string, unknown> = {},
  payload: SendMailPayload | null = invitation(key)
) {
  const [row] = await db
    .table('mail_deliveries')
    .insert({
      idempotency_key: key,
      kind: payload?.kind ?? MAIL_KINDS.organizationInvitation,
      to: `${key}@example.test`,
      status: 'failed',
      attempts: 6,
      error: 'ECONNREFUSED\n    at connect (net.js:1)',
      payload: payload ? JSON.stringify(payload) : null,
      created_at: SETTLED,
      updated_at: SETTLED,
      ...fields,
    })
    .returning('id')
  return Number(row.id ?? row)
}

test.group('Ops — emails', (group) => {
  useDatabase(group)

  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    return () => mail.restore()
  })
  const sentCount = () =>
    fakeMailer.mails.sent((sent) => sent instanceof OrganizationInvitationNotification).length

  test('refuse l’accès sans le droit, y compris au support et à l’analyste', async ({
    client,
    assert,
  }) => {
    const id = await delivery('k1')

    for (const state of ['platformModerator', 'platformSupport', 'platformAnalyst'] as const) {
      const user = await UserFactory.apply(state).create()
      const responses = [
        await client.get('/fr/admin/mail').withInertia().loginAs(user),
        await client.get(`/fr/admin/mail/${id}`).withInertia().loginAs(user),
        await client.get('/fr/admin/storage').withInertia().loginAs(user),
        await post(client, user, `/fr/admin/mail/${id}/retry`),
        await post(client, user, '/fr/admin/mail/retry'),
        await post(client, user, '/fr/admin/storage/recover'),
      ]
      for (const response of responses) response.assertStatus(403)
    }
    assert.equal(sentCount(), 0)
    assert.lengthOf(await AdminAuditLog.query().whereIn('action', ['mail.retried']), 0)
  })

  test('distingue envoyé, en échec et en cours, et calcule le taux d’échec par type', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await delivery('sent-1', { status: 'sent', sent_at: new Date(), payload: null }, null)
    await delivery('sent-2', { status: 'sent', sent_at: new Date(), payload: null }, null)
    await delivery('failed-1')
    await delivery('running-1', { updated_at: minutesAgo(2), attempts: 2 })
    await delivery('old-sent', { status: 'sent', created_at: minutesAgo(60 * 24 * 40) }, null)

    const response = await client.get('/fr/admin/mail').withInertia().loginAs(admin)

    response.assertStatus(200)
    const overview = response.inertiaProps.overview as AdminMailOverview
    assert.equal(overview.failedTotal, 1)
    const rate = overview.rates.find((row) => row.kind === MAIL_KINDS.organizationInvitation)!
    // L'envoi vieux de 40 jours sort de la fenêtre de 30 jours.
    assert.deepInclude(rate, { sent: 2, failed: 1, inProgress: 1 })
    assert.closeTo(rate.failureRate!, 1 / 3, 0.001)

    const rows = (response.inertiaProps.deliveries as { data: AdminMailRow[] }).data
    const byKey = Object.fromEntries(rows.map((row) => [row.to.split('@')[0], row]))
    assert.equal(byKey['sent-1'].status, 'sent')
    assert.equal(byKey['failed-1'].status, 'failed')
    assert.isTrue(byKey['failed-1'].retryable)
    assert.equal(byKey['failed-1'].error, 'ECONNREFUSED')
    assert.equal(byKey['running-1'].status, 'in_progress')
    assert.isFalse(byKey['running-1'].retryable)
  })

  test('filtre par état et par type', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await delivery('f1')
    await delivery('s1', { status: 'sent', payload: null }, null)
    await delivery('r1', { updated_at: minutesAgo(1) })
    const reset: SendMailPayload = {
      idempotencyKey: 'f2',
      kind: MAIL_KINDS.passwordReset,
      to: 'f2@example.test',
      locale: 'fr',
      data: { resetUrl: 'https://example.test/reset', expiresInMinutes: 60 },
    }
    await delivery('f2', {}, reset)

    const keys = async (query: string) => {
      const response = await client.get(`/fr/admin/mail?${query}`).withInertia().loginAs(admin)
      response.assertStatus(200)
      return (response.inertiaProps.deliveries as { data: AdminMailRow[] }).data
        .map((row) => row.to.split('@')[0])
        .sort()
    }

    assert.deepEqual(await keys('status=failed'), ['f1', 'f2'])
    assert.deepEqual(await keys('status=in_progress'), ['r1'])
    assert.deepEqual(await keys('status=sent'), ['s1'])
    assert.deepEqual(await keys('kind=password-reset'), ['f2'])
    assert.deepEqual(await keys('status=failed&kind=organization-invitation'), ['f1'])
  })

  test('la fiche montre l’erreur complète mais jamais la charge', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const id = await delivery('k1')

    const response = await client.get(`/fr/admin/mail/${id}`).withInertia().loginAs(admin)

    response.assertStatus(200)
    const detail = response.inertiaProps.delivery as AdminMailDetail
    assert.include(detail.fullError!, 'at connect')
    assert.equal(detail.idempotencyKey, 'k1')
    assert.notProperty(detail, 'payload')
    assert.notInclude(JSON.stringify(response.inertiaProps), 'acceptUrl')
  })

  test('une fiche inconnue renvoie 404', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client.get('/fr/admin/mail/999999').withInertia().loginAs(admin)

    response.assertStatus(404)
  })

  test('rejoue un mail en échec, une seule fois, avec audit', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const id = await delivery('k1')

    const response = await post(client, admin, `/fr/admin/mail/${id}/retry`)

    response.assertStatus(302)
    assert.equal(sentCount(), 1)
    const row = await db.from('mail_deliveries').where('id', id).firstOrFail()
    assert.equal(row.status, 'sent')
    assert.isNull(row.payload)

    const audit = await AdminAuditLog.query().where('action', 'mail.retried').firstOrFail()
    assert.equal(audit.targetType, 'mail_delivery')
    assert.equal(audit.targetId, id)
    assert.equal(audit.changes?.after?.kind, MAIL_KINDS.organizationInvitation)
    assert.equal(audit.actorUserId, admin.id)

    // Un second clic : le mail est parti, rien de plus n'est envoyé ni tracé.
    await post(client, admin, `/fr/admin/mail/${id}/retry`)
    assert.equal(sentCount(), 1)
    assert.lengthOf(await AdminAuditLog.query().where('action', 'mail.retried'), 1)
  })

  test('ne rejoue ni un mail en cours ni un mail sans charge', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const running = await delivery('r1', { updated_at: minutesAgo(1) })
    const empty = await delivery('e1', {}, null)

    await post(client, admin, `/fr/admin/mail/${running}/retry`)
    await post(client, admin, `/fr/admin/mail/${empty}/retry`)

    assert.equal(sentCount(), 0)
    assert.lengthOf(await AdminAuditLog.query().where('action', 'mail.retried'), 0)
  })

  test('rejoue la dead-letter d’un type, ou toute la dead-letter', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await delivery('f1')
    await delivery('f2')
    const reset: SendMailPayload = {
      idempotencyKey: 'p1',
      kind: MAIL_KINDS.passwordReset,
      to: 'p1@example.test',
      locale: 'fr',
      data: { resetUrl: 'https://example.test/reset', expiresInMinutes: 60 },
    }
    await delivery('p1', {}, reset)
    await delivery('e1', {}, null)

    await post(client, admin, '/fr/admin/mail/retry', { kind: 'organization-invitation' })

    assert.equal(sentCount(), 2)
    const statuses = async () => {
      const rows = await db.from('mail_deliveries').select('idempotency_key', 'status')
      return Object.fromEntries(rows.map((row) => [row.idempotency_key, row.status]))
    }
    assert.deepInclude(await statuses(), { f1: 'sent', f2: 'sent', p1: 'failed', e1: 'failed' })

    const audit = await AdminAuditLog.query().where('action', 'mail.bulk_retried').firstOrFail()
    assert.equal(audit.changes?.after?.kind, 'organization-invitation')
    assert.equal(audit.changes?.after?.requeued, 2)

    await post(client, admin, '/fr/admin/mail/retry')
    const after = await statuses()
    assert.equal(after.p1, 'sent')
    // La ligne sans charge reste en dead-letter : elle est comptée comme ignorée.
    assert.equal(after.e1, 'failed')
    const second = await AdminAuditLog.query().where('action', 'mail.bulk_retried').orderBy('id')
    assert.equal(second[1].changes?.after?.skipped, 1)
  })

  test('rejouer sans rien à rejouer n’écrit pas d’audit', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await delivery('r1', { updated_at: minutesAgo(1) })

    const response = await post(client, admin, '/fr/admin/mail/retry')

    response.assertStatus(302)
    assert.equal(sentCount(), 0)
    assert.lengthOf(await AdminAuditLog.query().where('action', 'mail.bulk_retried'), 0)
  })

  test('refuse un type de mail inconnu', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await post(client, admin, '/fr/admin/mail/retry', { kind: 'nope' })

    response.assertStatus(422)
  })
})

test.group('Ops — stockage', (group) => {
  useDatabase(group)
  useFakeStorage(group)

  test('compte les objets par état et liste l’arriéré de reprise', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await StorageObjectFactory.merge({ size: 1000 }).create()
    await StorageObjectFactory.merge({ size: 500 }).create()
    const stale = await StorageObjectFactory.apply('pendingUpload', 'stale')
      .merge({ size: 40 })
      .create()
    await StorageObjectFactory.apply('pendingDelete', 'stale').merge({ size: 30 }).create()
    await StorageObjectFactory.apply('pendingUpload').merge({ size: 20 }).create()

    const response = await client.get('/fr/admin/storage').withInertia().loginAs(admin)

    response.assertStatus(200)
    const overview = response.inertiaProps.overview as AdminStorageOverview
    const total = (status: string) => overview.totals.find((row) => row.status === status)!
    assert.deepInclude(total('ready'), { count: 2, bytes: 1500 })
    assert.deepInclude(total('pending_upload'), { count: 2, bytes: 60 })
    assert.deepInclude(total('pending_delete'), { count: 1, bytes: 30 })
    // Seules les lignes de plus de 24 h comptent dans l'arriéré, la plus ancienne d'abord.
    assert.equal(overview.staleCount, 2)
    assert.lengthOf(overview.stale, 2)
    assert.include(
      overview.stale.map((row) => row.id),
      stale.id
    )
  })

  test('rattache le volume prêt aux organisations, sans compter deux fois un objet', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const logo = await StorageObjectFactory.merge({ size: 1000 }).create()
    const orphan = await StorageObjectFactory.merge({ size: 300 }).create()
    const org = await OrganizationFactory.merge({
      logoStorageObjectId: logo.id,
      bannerStorageObjectId: logo.id,
    }).create()

    const response = await client.get('/fr/admin/storage').withInertia().loginAs(admin)

    const overview = response.inertiaProps.overview as AdminStorageOverview
    assert.deepEqual(overview.organizations, [
      { organizationId: org.id, name: org.name, count: 1, bytes: 1000 },
    ])
    assert.equal(overview.unattributedBytes, orphan.size)
  })

  test('relance la reprise : nettoie l’arriéré et trace l’action', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const stale = await StorageObjectFactory.apply('pendingUpload', 'stale').create()
    const fresh = await StorageObjectFactory.apply('pendingUpload').create()
    const ready = await StorageObjectFactory.create()

    const response = await post(client, admin, '/fr/admin/storage/recover')

    response.assertStatus(302)
    const rows = await db.from('storage_objects').select('id')
    const remaining = rows.map((row) => row.id)
    assert.notInclude(remaining, stale.id)
    assert.includeMembers(remaining, [fresh.id, ready.id])

    const audit = await AdminAuditLog.query()
      .where('action', 'storage.recovery_requested')
      .firstOrFail()
    assert.equal(audit.targetType, 'storage')
    assert.equal(audit.changes?.after?.stale, 1)
    assert.equal(audit.actorUserId, admin.id)
  })
})
