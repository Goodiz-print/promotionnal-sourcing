import { test } from '@japa/runner'
import emitter from '@adonisjs/core/services/emitter'
import mail from '@adonisjs/mail/services/main'
import { NotificationFactory } from '#database/factories/notification_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { QuoteFactory } from '#database/factories/quote_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import MemberJoined from '#events/member_joined'
import QuoteAccepted from '#events/quote_accepted'
import QuoteRejected from '#events/quote_rejected'
import QuoteSubmitted from '#events/quote_submitted'
import RfqDeclined from '#events/rfq_declined'
import RfqSent from '#events/rfq_sent'
import Notification from '#models/notification'
import { createMember, subscribeOrganization } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type User from '#models/user'

/**
 * Notifications in-app (#57) : les événements métier créent une notification
 * pour les membres qui peuvent agir, et seulement eux ; les écrans la listent,
 * la marquent lue et cloisonnent par utilisateur.
 */
async function notificationsOf(user: User): Promise<Notification[]> {
  return Notification.query().where('userId', user.id).orderBy('id')
}

/** Une demande publiée par un acheteur (owner + member), reçue par un fournisseur (owner + manager + member). */
async function scenario() {
  const buyer = await OrganizationFactory.create()
  const buyerOwner = await createMember(buyer, 'owner')
  const buyerMember = await createMember(buyer, 'member')
  const supplier = await OrganizationFactory.apply('supplier').create()
  const supplierOwner = await createMember(supplier, 'owner')
  const supplierManager = await createMember(supplier, 'manager')
  const supplierMember = await createMember(supplier, 'member')
  const rfq = await RfqFactory.apply('published').merge({ buyerOrganizationId: buyer.id }).create()
  const recipient = await RfqSupplierFactory.apply('sent')
    .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id })
    .create()
  // `RfqService#send` renvoie les destinataires avec leur organisation chargée.
  await recipient.load('supplierOrganization')
  return {
    buyer,
    buyerOwner,
    buyerMember,
    supplier,
    supplierOwner,
    supplierManager,
    supplierMember,
    rfq,
    recipient,
  }
}

test.group('Notifications in-app — événements métier', (group) => {
  useDatabase(group)

  // Les mails mis en queue par les listeners ne doivent pas partir en vrai SMTP.
  group.each.setup(() => {
    mail.fake()
    return () => mail.restore()
  })

  test('RfqSent : les responsables du fournisseur reçoivent la demande, pas un member', async ({
    assert,
  }) => {
    const { buyer, rfq, recipient, supplierOwner, supplierManager, supplierMember, buyerOwner } =
      await scenario()
    // Abonné : la notification nomme l'agence (#220).
    await subscribeOrganization(recipient.supplierOrganization)

    await emitter.emit(RfqSent, new RfqSent(rfq, buyer, [recipient]))

    for (const user of [supplierOwner, supplierManager]) {
      const [notification] = await notificationsOf(user)
      assert.equal(notification.type, 'rfq.received')
      assert.deepInclude(notification.data, {
        rfqId: rfq.id,
        rfqTitle: rfq.title,
        buyerName: buyer.name,
      })
      assert.isNull(notification.readAt)
    }
    assert.lengthOf(await notificationsOf(supplierMember), 0)
    assert.lengthOf(await notificationsOf(buyerOwner), 0)
  })

  test('RfqDeclined : les responsables de l’acheteur apprennent le refus', async ({ assert }) => {
    const { rfq, supplier, buyerOwner, buyerMember, supplierOwner } = await scenario()

    await emitter.emit(RfqDeclined, new RfqDeclined(rfq, supplier.id))

    const [notification] = await notificationsOf(buyerOwner)
    assert.equal(notification.type, 'rfq.declined')
    assert.equal(notification.data.supplierName, supplier.name)
    assert.lengthOf(await notificationsOf(buyerMember), 0)
    assert.lengthOf(await notificationsOf(supplierOwner), 0)
  })

  test('QuoteSubmitted : l’acheteur est prévenu en plus du mail', async ({ assert }) => {
    const { rfq, supplier, buyerOwner, buyerMember } = await scenario()
    const quote = await QuoteFactory.apply('submitted')
      .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id })
      .create()

    await emitter.emit(QuoteSubmitted, new QuoteSubmitted(quote))

    const [notification] = await notificationsOf(buyerOwner)
    assert.equal(notification.type, 'quote.received')
    assert.deepInclude(notification.data, { quoteId: quote.id, supplierName: supplier.name })
    assert.lengthOf(await notificationsOf(buyerMember), 0)
  })

  test('QuoteAccepted / QuoteRejected : le fournisseur apprend la décision', async ({ assert }) => {
    const { rfq, buyer, supplier, supplierOwner, supplierMember } = await scenario()
    const quote = await QuoteFactory.apply('accepted')
      .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id })
      .create()

    await emitter.emit(QuoteAccepted, new QuoteAccepted(quote))
    await emitter.emit(QuoteRejected, new QuoteRejected(quote))

    // L'acceptation crée aussi la commande (#6) : ses notifications se testent dans `orders.spec.ts`.
    const all = await notificationsOf(supplierOwner)
    const notifications = all.filter((notification) => notification.type.startsWith('quote.'))
    assert.deepEqual(
      notifications.map((notification) => notification.type),
      ['quote.accepted', 'quote.rejected']
    )
    assert.equal(notifications[0].data.buyerName, buyer.name)
    assert.lengthOf(await notificationsOf(supplierMember), 0)
  })

  test('MemberJoined : les propriétaires et admins le voient, pas le nouveau membre', async ({
    assert,
  }) => {
    const { buyer, buyerOwner, buyerMember } = await scenario()
    const joiner = await createMember(buyer, 'manager', {
      firstName: 'Camille',
      lastName: 'Durand',
    })

    await emitter.emit(MemberJoined, new MemberJoined(buyer, joiner))

    const [notification] = await notificationsOf(buyerOwner)
    assert.equal(notification.type, 'organization.member_joined')
    assert.deepInclude(notification.data, {
      memberName: 'Camille Durand',
      organizationName: buyer.name,
    })
    assert.lengthOf(await notificationsOf(joiner), 0)
    assert.lengthOf(await notificationsOf(buyerMember), 0)
  })
})

test.group('Notifications in-app — écrans', (group) => {
  useDatabase(group)

  test('la liste ne montre que les notifications de l’utilisateur, avec leur lien', async ({
    client,
    assert,
  }) => {
    const org = await OrganizationFactory.create()
    const user = await createMember(org, 'owner')
    const other = await createMember(await OrganizationFactory.create(), 'owner')
    await NotificationFactory.merge({
      userId: user.id,
      type: 'rfq.declined',
      data: { rfqId: 7, rfqTitle: 'Tote bags', supplierName: 'Acme' },
    }).create()
    await NotificationFactory.merge({ userId: other.id, type: 'rfq.received', data: {} }).create()

    const response = await client.get('/fr/notifications').withInertia().loginAs(user)

    response.assertStatus(200)
    response.assertInertiaComponent('notifications/index')
    const { notifications } = response.inertiaProps
    assert.lengthOf(notifications, 1)
    assert.equal(notifications[0].href, '/fr/rfqs/7')
  })

  test('cliquer marque lue puis redirige vers l’écran concerné', async ({ client, assert }) => {
    const org = await OrganizationFactory.create()
    const user = await createMember(org, 'owner')
    const notification = await NotificationFactory.merge({
      userId: user.id,
      type: 'rfq.declined',
      data: { rfqId: 7 },
    }).create()

    const response = await client
      .patch(`/fr/notifications/${notification.id}/read`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(user)

    // Redirection Inertia d'un PATCH : 303, pour que le navigateur suive en GET.
    response.assertStatus(303)
    assert.equal(response.header('location'), '/fr/rfqs/7')
    await notification.refresh()
    assert.isNotNull(notification.readAt)
  })

  test('la notification d’un autre utilisateur est introuvable et reste non lue', async ({
    client,
    assert,
  }) => {
    const user = await createMember(await OrganizationFactory.create(), 'owner')
    const other = await createMember(await OrganizationFactory.create(), 'owner')
    const notification = await NotificationFactory.merge({ userId: other.id }).create()

    const response = await client
      .patch(`/fr/notifications/${notification.id}/read`)
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(user)

    response.assertStatus(404)
    await notification.refresh()
    assert.isNull(notification.readAt)
  })

  test('tout marquer comme lu ne touche que l’utilisateur courant', async ({ client, assert }) => {
    const user = await createMember(await OrganizationFactory.create(), 'owner')
    const other = await createMember(await OrganizationFactory.create(), 'owner')
    await NotificationFactory.merge({ userId: user.id }).createMany(2)
    const untouched = await NotificationFactory.merge({ userId: other.id }).create()

    await client
      .post('/fr/notifications/read-all')
      .withInertia()
      .withCsrfToken()
      .redirects(0)
      .loginAs(user)

    const unread = await Notification.query().where('userId', user.id).whereNull('readAt')
    assert.lengthOf(unread, 0)
    await untouched.refresh()
    assert.isNull(untouched.readAt)
  })

  test('chaque page porte le compteur de non lues ; la liste attend le partial reload', async ({
    client,
    assert,
  }) => {
    const user = await createMember(await OrganizationFactory.create(), 'owner')
    await NotificationFactory.merge({ userId: user.id }).createMany(3)
    await NotificationFactory.merge({ userId: user.id }).apply('read').create()

    const page = await client.get('/fr/notifications').withInertia().loginAs(user)
    assert.equal(page.inertiaProps.unreadNotificationsCount, 3)
    assert.isUndefined(page.inertiaProps.recentNotifications)

    const reload = await client
      .get('/fr/notifications')
      .withInertia()
      .header('X-Inertia-Partial-Component', 'notifications/index')
      .header('X-Inertia-Partial-Data', 'recentNotifications')
      .loginAs(user)
    assert.lengthOf(reload.inertiaProps.recentNotifications, 4)
  })

  test('un visiteur est renvoyé vers la connexion', async ({ client }) => {
    const response = await client.get('/fr/notifications').redirects(0)

    response.assertStatus(302)
  })
})
