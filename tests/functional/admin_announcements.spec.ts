import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import mail from '@adonisjs/mail/services/main'
import { AgencyProfileFactory } from '#database/factories/agency_profile_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import AnnouncementNotification from '#mails/announcement_notification'
import AdminAuditLog from '#models/admin_audit_log'
import Notification from '#models/notification'
import AnnouncementDispatcher from '#services/announcement_dispatcher'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type User from '#models/user'
import type { AdminAnnouncementRow } from '#shared/types/announcement'

/**
 * Annonces plateforme (#169). `QUEUE_DRIVER=sync` en test : le job de distribution
 * s'exécute dans la requête, les notifications existent dès la réponse.
 */
const VALID = {
  audience: 'all',
  channels: ['inApp'],
  titleFr: 'Maintenance',
  bodyFr: 'La plateforme sera indisponible dimanche.',
  confirm: true,
}

function post(client: any, user: unknown, body: Record<string, unknown> = VALID) {
  return client
    .post('/fr/admin/announcements')
    .json(body)
    .redirects(0)
    .withCsrfToken()
    .header('Accept', 'application/json')
    .loginAs(user)
}

async function titleOf(user: User): Promise<unknown> {
  const [notification] = await notificationsOf(user)
  return notification.data.title
}

async function notificationsOf(user: User): Promise<Notification[]> {
  return Notification.query().where('userId', user.id).where('type', 'announcement')
}

test.group('Annonces — administration', (group) => {
  useDatabase(group)

  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    return () => mail.restore()
  })

  test('refuse l’accès sans le droit, y compris au support et au modérateur', async ({
    client,
  }) => {
    for (const state of ['platformModerator', 'platformSupport', 'platformAnalyst'] as const) {
      const user = await UserFactory.apply(state).create()
      const list = await client.get('/fr/admin/announcements').withInertia().loginAs(user)
      list.assertStatus(403)
      const created = await post(client, user)
      created.assertStatus(403)
    }
  })

  test('envoie à tous les utilisateurs actifs, sans les suspendus', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.create()
    const member = await createMember(organization)
    const loner = await UserFactory.create()
    const suspended = await UserFactory.merge({ suspendedAt: DateTime.now() }).create()

    const response = await post(client, admin)

    response.assertStatus(302)
    assert.lengthOf(await notificationsOf(member), 1)
    assert.lengthOf(await notificationsOf(loner), 1)
    assert.lengthOf(await notificationsOf(admin), 1)
    assert.lengthOf(await notificationsOf(suspended), 0)

    assert.equal(await titleOf(member), 'Maintenance')
    const [notification] = await notificationsOf(member)
    assert.isNull(notification.readAt)

    const row = await db.from('announcements').first()
    assert.equal(row.status, 'sent')
    assert.equal(row.recipients_count, 3)
    assert.isNotNull(row.sent_at)
    fakeMailer.mails.assertNoneSent()
  })

  test('cible acheteurs, fournisseurs, agences ou une organisation', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const buyerOrg = await OrganizationFactory.create()
    const supplierOrg = await OrganizationFactory.apply('supplier').create()
    const bothOrg = await OrganizationFactory.apply('both').create()
    const agencyOrg = await OrganizationFactory.create()
    await AgencyProfileFactory.merge({ organizationId: agencyOrg.id }).create()
    const archivedOrg = await OrganizationFactory.apply('archived').create()

    const buyer = await createMember(buyerOrg)
    const supplier = await createMember(supplierOrg)
    const both = await createMember(bothOrg)
    const agency = await createMember(agencyOrg)
    const archived = await createMember(archivedOrg)

    const received = async () => {
      const ids: number[] = []
      for (const user of [buyer, supplier, both, agency, archived]) {
        const notifications = await notificationsOf(user)
        if (notifications.length > 0) ids.push(user.id)
      }
      return ids
    }
    const clear = () => Notification.query().where('type', 'announcement').delete()

    await post(client, admin, { ...VALID, audience: 'buyers' })
    // Une agence est une organisation acheteuse ; l'organisation archivée est exclue.
    assert.sameMembers(await received(), [buyer.id, both.id, agency.id])
    await clear()
    await db.from('announcements').delete()

    await post(client, admin, { ...VALID, audience: 'suppliers' })
    assert.sameMembers(await received(), [supplier.id, both.id])
    await clear()
    await db.from('announcements').delete()

    await post(client, admin, { ...VALID, audience: 'agencies' })
    assert.sameMembers(await received(), [agency.id])
    await clear()
    await db.from('announcements').delete()

    await post(client, admin, {
      ...VALID,
      audience: 'organization',
      organizationId: supplierOrg.id,
    })
    assert.sameMembers(await received(), [supplier.id])
  })

  test('sert la langue du destinataire, avec repli anglais puis français', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const english = await UserFactory.merge({ locale: 'en' }).create()
    const german = await UserFactory.merge({ locale: 'de' }).create()
    const french = await UserFactory.merge({ locale: 'fr' }).create()

    await post(client, admin, {
      ...VALID,
      titleEn: 'Maintenance window',
      bodyEn: 'Down on Sunday.',
    })

    assert.equal(await titleOf(english), 'Maintenance window')
    assert.equal(await titleOf(german), 'Maintenance window')
    assert.equal(await titleOf(french), 'Maintenance')
  })

  test('sans traduction anglaise, tout le monde reçoit le français', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const english = await UserFactory.merge({ locale: 'en' }).create()

    await post(client, admin)

    assert.equal(await titleOf(english), 'Maintenance')
  })

  test('le canal mail ne part que vers les adresses vérifiées, dans leur langue', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const verified = await UserFactory.merge({ locale: 'en' }).create()
    const unverified = await UserFactory.apply('unverified').create()

    await post(client, admin, {
      ...VALID,
      channels: ['email'],
      titleEn: 'Maintenance window',
      bodyEn: 'Down on Sunday.',
    })

    fakeMailer.mails.assertSent(AnnouncementNotification, ({ message }) => {
      if (!message.hasTo(verified.email)) return false
      assert.isTrue(message.hasSubject('Maintenance window'))
      return true
    })
    assert.isEmpty(fakeMailer.mails.sent((m) => m.message.hasTo(unverified.email)))
    // Canal mail seul : aucune notification in-app.
    assert.lengthOf(await notificationsOf(verified), 0)
  })

  test('la distribution est rejouable : une notification par utilisateur', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const member = await UserFactory.create()
    await post(client, admin, { ...VALID, channels: ['inApp', 'email'] })
    const stored = await db.from('announcements').first()
    // Reprise après un échec en cours de route : l'annonce n'est plus « envoyée ».
    await db.from('announcements').where('id', stored.id).update({ status: 'sending' })

    const dispatcher = await app.container.make(AnnouncementDispatcher)
    await dispatcher.deliver(stored.id)

    assert.lengthOf(await notificationsOf(member), 1)
    // Même clé d'idempotence : le mail n'est pas renvoyé.
    assert.lengthOf(
      fakeMailer.mails.sent((m) => m.message.hasTo(member.email)),
      1
    )
  })

  test('trace la création dans le journal d’audit', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    await post(client, admin)

    const [log] = await AdminAuditLog.all()
    assert.equal(log.action, 'announcement.created')
    assert.equal(log.targetType, 'announcement')
    assert.equal(log.actorUserId, admin.id)
    assert.equal(log.changes?.after?.audience, 'all')
  })

  test('valide le formulaire', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const cases: Record<string, unknown>[] = [
      { ...VALID, channels: [] },
      { ...VALID, confirm: false },
      { ...VALID, titleFr: '' },
      { ...VALID, audience: 'organization' },
      { ...VALID, audience: 'everyone' },
      { ...VALID, titleEn: 'Only a title' },
    ]
    for (const body of cases) {
      const response = await post(client, admin, body)
      response.assertStatus(422)
    }
    assert.lengthOf(await db.from('announcements'), 0)
  })

  test('une organisation inconnue est une 404 sans annonce ni audit', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await post(client, admin, {
      ...VALID,
      audience: 'organization',
      organizationId: 99999,
    })

    response.assertStatus(404)
    assert.lengthOf(await db.from('announcements'), 0)
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('l’historique donne le segment, les destinataires et le taux de lecture', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const readers = [await UserFactory.create(), await UserFactory.create()]
    await post(client, admin)
    const [first] = await notificationsOf(readers[0])
    await first.merge({ readAt: DateTime.now() }).save()

    const response = await client.get('/fr/admin/announcements').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/announcements/index')
    const [row] = response.inertiaProps.announcements.data as AdminAnnouncementRow[]
    assert.equal(row.title, 'Maintenance')
    assert.equal(row.audience, 'all')
    assert.equal(row.status, 'sent')
    assert.equal(row.recipients, 3)
    assert.equal(row.read, 1)
    assert.equal(row.createdBy, admin.email)
  })

  test('le formulaire annonce la taille de chaque segment', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const supplierOrg = await OrganizationFactory.apply('supplier').create()
    await createMember(supplierOrg)

    const response = await client.get('/fr/admin/announcements/new').withInertia().loginAs(admin)

    response.assertInertiaComponent('admin/announcements/create')
    assert.deepEqual(response.inertiaProps.audienceSizes, {
      all: 2,
      buyers: 0,
      suppliers: 1,
      agencies: 0,
    })
  })
})
