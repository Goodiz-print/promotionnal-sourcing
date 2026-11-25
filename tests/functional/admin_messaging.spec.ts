import { test } from '@japa/runner'
import { ConversationFactory } from '#database/factories/conversation_factory'
import { MessageFactory } from '#database/factories/message_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import AdminAuditLog from '#models/admin_audit_log'
import Conversation from '#models/conversation'
import Message from '#models/message'
import MessageReport from '#models/message_report'
import Notification from '#models/notification'
import RealtimeService from '#services/realtime_service'
import ConversationService from '#services/conversation_service'
import { ConversationBlockedException } from '#exceptions/messaging_errors'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type {
  AdminConversationDetail,
  AdminConversationRow,
  AdminReportRow,
} from '#shared/types/admin_messaging'

/**
 * Modération de la messagerie (#167) : consultation tracée, signalement par un
 * participant, décisions de la plateforme.
 */

async function thread() {
  const buyer = await OrganizationFactory.create()
  const supplier = await OrganizationFactory.apply('supplier').create()
  const buyerUser = await createMember(buyer)
  const supplierUser = await createMember(supplier)
  const conversation = await ConversationFactory.merge({
    buyerOrganizationId: buyer.id,
    supplierOrganizationId: supplier.id,
    subject: 'Devis stylos',
  }).create()
  const fromSupplier = await MessageFactory.merge({
    conversationId: conversation.id,
    authorUserId: supplierUser.id,
    body: 'Contactez-moi hors plateforme',
  }).create()
  const fromBuyer = await MessageFactory.apply('fromAgency')
    .merge({
      conversationId: conversation.id,
      authorUserId: buyerUser.id,
    })
    .create()
  return { buyer, supplier, buyerUser, supplierUser, conversation, fromSupplier, fromBuyer }
}

/** Action par JSON : un refus (403), un conflit (409) ou une validation (422) gardent leur statut. */
function post(client: any, user: unknown, path: string, body: Record<string, unknown> = {}) {
  return client
    .post(`/fr${path}`)
    .json(body)
    .redirects(0)
    .withCsrfToken()
    .header('Accept', 'application/json')
    .loginAs(user)
}

async function report(client: any, user: unknown, messageId: number, reason = 'off_platform') {
  return post(client, user, `/messages/${messageId}/report`, {
    reason,
    details: 'Ils veulent sortir de la plateforme',
  })
}

test.group('Messagerie admin — droits', (group) => {
  useDatabase(group)

  test('admin et modérateur consultent, support et analyste sont refusés', async ({ client }) => {
    const { conversation } = await thread()

    for (const role of ['platformAdmin', 'platformModerator'] as const) {
      const user = await UserFactory.apply(role).create()
      for (const [path, component] of [
        ['/fr/admin/messaging', 'admin/messaging/index'],
        ['/fr/admin/messaging/reports', 'admin/messaging/reports'],
        [`/fr/admin/messaging/conversations/${conversation.id}`, 'admin/messaging/show'],
      ]) {
        const response = await client.get(path).withInertia().loginAs(user)
        response.assertStatus(200)
        response.assertInertiaComponent(component)
      }
    }

    for (const role of ['platformSupport', 'platformAnalyst'] as const) {
      const user = await UserFactory.apply(role).create()
      const response = await client.get('/fr/admin/messaging').withInertia().loginAs(user)
      response.assertStatus(403)
    }
  })

  test('sans le droit, aucune décision n’est possible et rien n’est écrit', async ({
    client,
    assert,
  }) => {
    const { conversation, fromSupplier } = await thread()
    const support = await UserFactory.apply('platformSupport').create()

    for (const path of [
      `/admin/messaging/messages/${fromSupplier.id}/hide`,
      `/admin/messaging/messages/${fromSupplier.id}/warn`,
      `/admin/messaging/conversations/${conversation.id}/block`,
    ]) {
      const response = await post(client, support, path, { reason: 'Abus répété' })
      response.assertStatus(403)
    }

    await fromSupplier.refresh()
    await conversation.refresh()
    assert.isNull(fromSupplier.hiddenAt)
    assert.isNull(conversation.blockedAt)
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })
})

test.group('Messagerie admin — consultation', (group) => {
  useDatabase(group)

  test('ouvrir un fil écrit une entrée d’audit, lister n’en écrit pas', async ({
    client,
    assert,
  }) => {
    const { conversation } = await thread()
    const moderator = await UserFactory.apply('platformModerator').create()

    const list = await client.get('/fr/admin/messaging').withInertia().loginAs(moderator)
    list.assertStatus(200)
    assert.lengthOf(await AdminAuditLog.all(), 0)

    const rows = (list.inertiaProps as { conversations: { data: AdminConversationRow[] } })
      .conversations.data
    assert.deepEqual(
      rows.map((row) => [row.id, row.messagesCount, row.openReportsCount]),
      [[conversation.id, 2, 0]]
    )

    const show = await client
      .get(`/fr/admin/messaging/conversations/${conversation.id}`)
      .withInertia()
      .loginAs(moderator)
    show.assertStatus(200)
    const detail = (show.inertiaProps as { detail: AdminConversationDetail }).detail
    assert.lengthOf(detail.messages, 2)

    const logs = await AdminAuditLog.all()
    assert.lengthOf(logs, 1)
    assert.equal(logs[0].action, 'conversation.viewed')
    assert.equal(logs[0].targetType, 'conversation')
    assert.equal(logs[0].targetId, conversation.id)
    assert.equal(logs[0].actorUserId, moderator.id)
  })

  test('un fil inconnu est une 404 sans trace d’audit', async ({ client, assert }) => {
    const moderator = await UserFactory.apply('platformModerator').create()
    const response = await client
      .get('/fr/admin/messaging/conversations/99999')
      .header('Accept', 'application/json')
      .loginAs(moderator)
    response.assertStatus(404)
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('filtres : signalements ouverts et fils bloqués', async ({ client, assert }) => {
    const { conversation, fromSupplier, buyerUser } = await thread()
    const other = await thread()
    await other.conversation.merge({ blockedReason: 'Abus' }).save()
    const moderator = await UserFactory.apply('platformModerator').create()
    await report(client, buyerUser, fromSupplier.id)

    const withReports = await client
      .get('/fr/admin/messaging?withOpenReports=1')
      .withInertia()
      .loginAs(moderator)
    assert.deepEqual(
      (
        withReports.inertiaProps as { conversations: { data: AdminConversationRow[] } }
      ).conversations.data.map((row) => row.id),
      [conversation.id]
    )

    const queue = await client.get('/fr/admin/messaging/reports').withInertia().loginAs(moderator)
    const rows = (queue.inertiaProps as { reports: { data: AdminReportRow[] } }).reports.data
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].reason, 'off_platform')
    assert.equal(rows[0].messageExcerpt, 'Contactez-moi hors plateforme')
  })
})

test.group('Messagerie — signalement par un participant', (group) => {
  useDatabase(group)

  test('un participant signale le message d’en face, une seule fois', async ({
    client,
    assert,
  }) => {
    const { buyerUser, fromSupplier } = await thread()

    const first = await report(client, buyerUser, fromSupplier.id, 'spam')
    assert.isAtLeast(first.status(), 200)
    assert.isBelow(first.status(), 400)

    const again = await report(client, buyerUser, fromSupplier.id, 'fraud')
    assert.isBelow(again.status(), 400)

    const reports = await MessageReport.all()
    assert.lengthOf(reports, 1)
    assert.equal(reports[0].reason, 'fraud')
    assert.equal(reports[0].status, 'open')
    assert.equal(reports[0].reporterUserId, buyerUser.id)
  })

  test('signaler un message déjà traité ne rouvre rien', async ({ client, assert }) => {
    const { buyerUser, fromSupplier } = await thread()
    await report(client, buyerUser, fromSupplier.id)
    const stored = await MessageReport.firstOrFail()
    const moderator = await UserFactory.apply('platformModerator').create()
    await post(client, moderator, `/admin/messaging/reports/${stored.id}/dismiss`)

    const response = await report(client, buyerUser, fromSupplier.id, 'fraud')
    assert.isBelow(response.status(), 400)

    await stored.refresh()
    assert.equal(stored.status, 'resolved')
    assert.equal(stored.reason, 'off_platform')
    assert.lengthOf(await MessageReport.all(), 1)
  })

  test('on ne signale pas son propre message', async ({ client, assert }) => {
    const { buyerUser, fromBuyer } = await thread()
    const response = await report(client, buyerUser, fromBuyer.id)
    response.assertStatus(422)
    assert.lengthOf(await MessageReport.all(), 0)
  })

  test('un tiers reçoit une 404, pas un 403', async ({ client, assert }) => {
    const { fromSupplier } = await thread()
    const outsider = await createMember(await OrganizationFactory.create())
    const response = await report(client, outsider, fromSupplier.id)
    response.assertStatus(404)
    assert.lengthOf(await MessageReport.all(), 0)
  })

  test('un motif inconnu est refusé', async ({ client, assert }) => {
    const { buyerUser, fromSupplier } = await thread()
    const response = await report(client, buyerUser, fromSupplier.id, 'nimporte')
    response.assertStatus(422)
    assert.lengthOf(await MessageReport.all(), 0)
  })
})

test.group('Messagerie admin — décisions', (group) => {
  useDatabase(group)

  test('masquer clôt les signalements du message et laisse une trace', async ({
    client,
    assert,
  }) => {
    const { buyerUser, fromSupplier } = await thread()
    await report(client, buyerUser, fromSupplier.id)
    const moderator = await UserFactory.apply('platformModerator').create()

    const response = await post(
      client,
      moderator,
      `/admin/messaging/messages/${fromSupplier.id}/hide`
    )
    assert.isBelow(response.status(), 400)

    await fromSupplier.refresh()
    assert.isNotNull(fromSupplier.hiddenAt)
    assert.equal(fromSupplier.hiddenByUserId, moderator.id)
    const stored = await MessageReport.firstOrFail()
    assert.equal(stored.status, 'resolved')
    assert.equal(stored.resolution, 'hidden')
    assert.equal(stored.handledByUserId, moderator.id)

    const log = await AdminAuditLog.query().where('action', 'message.hidden').firstOrFail()
    assert.equal(log.targetId, fromSupplier.id)

    const twice = await post(client, moderator, `/admin/messaging/messages/${fromSupplier.id}/hide`)
    twice.assertStatus(409)
    assert.lengthOf(await AdminAuditLog.query().where('action', 'message.hidden'), 1)
  })

  test('réafficher un message masqué, pas un message visible', async ({ client, assert }) => {
    const { fromSupplier } = await thread()
    const moderator = await UserFactory.apply('platformModerator').create()

    const visible = await post(
      client,
      moderator,
      `/admin/messaging/messages/${fromSupplier.id}/unhide`
    )
    visible.assertStatus(409)

    await post(client, moderator, `/admin/messaging/messages/${fromSupplier.id}/hide`)
    const response = await post(
      client,
      moderator,
      `/admin/messaging/messages/${fromSupplier.id}/unhide`
    )
    assert.isBelow(response.status(), 400)
    await fromSupplier.refresh()
    assert.isNull(fromSupplier.hiddenAt)
    assert.lengthOf(await AdminAuditLog.query().where('action', 'message.unhidden'), 1)
  })

  test('avertir notifie l’auteur et clôt le signalement', async ({ client, assert }) => {
    const { buyerUser, supplierUser, fromSupplier } = await thread()
    await report(client, buyerUser, fromSupplier.id)
    const moderator = await UserFactory.apply('platformModerator').create()

    const response = await post(
      client,
      moderator,
      `/admin/messaging/messages/${fromSupplier.id}/warn`
    )
    assert.isBelow(response.status(), 400)

    const notification = await Notification.query().where('userId', supplierUser.id).firstOrFail()
    assert.equal(notification.type, 'message.warned')
    const warnedReport = await MessageReport.firstOrFail()
    assert.equal(warnedReport.resolution, 'warned')
    assert.lengthOf(await AdminAuditLog.query().where('action', 'message.warned'), 1)
    await fromSupplier.refresh()
    assert.isNull(fromSupplier.hiddenAt)
  })

  test('avertir deux fois le même message est refusé', async ({ client, assert }) => {
    const { supplierUser, fromSupplier } = await thread()
    const moderator = await UserFactory.apply('platformModerator').create()
    const path = `/admin/messaging/messages/${fromSupplier.id}/warn`

    const first = await post(client, moderator, path)
    assert.isBelow(first.status(), 400)
    const twice = await post(client, moderator, path)
    twice.assertStatus(409)

    assert.lengthOf(await Notification.query().where('userId', supplierUser.id), 1)
    assert.lengthOf(await AdminAuditLog.query().where('action', 'message.warned'), 1)
  })

  test('avertir un message sans auteur connu est refusé', async ({ client, assert }) => {
    const { conversation } = await thread()
    const orphan = await MessageFactory.merge({
      conversationId: conversation.id,
      authorUserId: null,
    }).create()
    const moderator = await UserFactory.apply('platformModerator').create()

    const response = await post(client, moderator, `/admin/messaging/messages/${orphan.id}/warn`)
    response.assertStatus(409)
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('un message masqué n’est plus renvoyé aux participants, un fil bloqué reste lisible', async ({
    client,
    assert,
  }) => {
    const { conversation, fromSupplier } = await thread()
    const moderator = await UserFactory.apply('platformModerator').create()
    const service = new ConversationService(new RealtimeService())

    await post(client, moderator, `/admin/messaging/messages/${fromSupplier.id}/hide`)
    await post(client, moderator, `/admin/messaging/conversations/${conversation.id}/block`, {
      reason: 'Contournement répété',
    })

    const visible = await service.messagesOf(await Conversation.findOrFail(conversation.id))
    assert.lengthOf(visible, 1)
    assert.notEqual(visible[0].id, fromSupplier.id)
  })

  test('classer sans suite un signalement ouvert, une seule fois', async ({ client, assert }) => {
    const { buyerUser, fromSupplier } = await thread()
    await report(client, buyerUser, fromSupplier.id)
    const stored = await MessageReport.firstOrFail()
    const moderator = await UserFactory.apply('platformModerator').create()

    const response = await post(client, moderator, `/admin/messaging/reports/${stored.id}/dismiss`)
    assert.isBelow(response.status(), 400)
    await stored.refresh()
    assert.equal(stored.resolution, 'dismissed')

    const twice = await post(client, moderator, `/admin/messaging/reports/${stored.id}/dismiss`)
    twice.assertStatus(409)
    assert.lengthOf(await AdminAuditLog.query().where('action', 'message_report.dismissed'), 1)
  })

  test('bloquer exige un motif, interdit l’écriture et se lève', async ({ client, assert }) => {
    const { conversation, buyerUser } = await thread()
    const moderator = await UserFactory.apply('platformModerator').create()
    const path = `/admin/messaging/conversations/${conversation.id}`

    const withoutReason = await post(client, moderator, `${path}/block`, {})
    withoutReason.assertStatus(422)

    const blocked = await post(client, moderator, `${path}/block`, {
      reason: 'Contournement répété',
    })
    assert.isBelow(blocked.status(), 400)
    const stored = await Conversation.findOrFail(conversation.id)
    assert.isNotNull(stored.blockedAt)
    assert.equal(stored.blockedReason, 'Contournement répété')

    const service = new ConversationService(new RealtimeService())
    await assert.rejects(
      () => service.post(stored, buyerUser, 'Encore un message'),
      ConversationBlockedException.message
    )
    assert.lengthOf(await Message.query().where('conversationId', conversation.id), 2)

    const again = await post(client, moderator, `${path}/block`, { reason: 'Encore' })
    again.assertStatus(409)

    const unblocked = await post(client, moderator, `${path}/unblock`)
    assert.isBelow(unblocked.status(), 400)
    const reopened = await Conversation.findOrFail(conversation.id)
    assert.isNull(reopened.blockedAt)
    await service.post(reopened, buyerUser, 'Reprise de la discussion')
    assert.lengthOf(await Message.query().where('conversationId', conversation.id), 3)
    assert.lengthOf(
      await AdminAuditLog.query().whereIn('action', [
        'conversation.blocked',
        'conversation.unblocked',
      ]),
      2
    )
  })
})
