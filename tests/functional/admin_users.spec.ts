import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'
import { UserFactory, TEST_PASSWORD } from '#database/factories/user_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { PasskeyFactory } from '#database/factories/passkey_factory'
import { LegalConsentFactory } from '#database/factories/legal_consent_factory'
import AdminAuditLog from '#models/admin_audit_log'
import EmailVerificationNotification from '#mails/email_verification_notification'
import PasswordResetNotification from '#mails/password_reset_notification'
import { createMember, createOrganizationWithOwner } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type { AdminUserDetail, AdminUserIndexFilters } from '#shared/types/admin_user'

interface ListedUser {
  id: number
  email: string
  organizationsCount: number
  platformRole: string
  emailVerified: boolean
  lastLoginAt: string | null
  suspendedAt: string | null
}

interface UserList {
  users: { data: ListedUser[]; meta: { total: number } }
  filters: AdminUserIndexFilters
}

interface UserDetail {
  account: AdminUserDetail
}

async function userList(client: any, actor: unknown, qs = '') {
  const response = await client.get(`/fr/admin/users${qs}`).withInertia().loginAs(actor)
  response.assertStatus(200)
  return response.inertiaProps as UserList
}

async function userShow(client: any, actor: unknown, userId: number) {
  const response = await client.get(`/fr/admin/users/${userId}`).withInertia().loginAs(actor)
  response.assertStatus(200)
  return response.inertiaProps as UserDetail
}

function userAction(client: any, actor: unknown, userId: number, name: string, method = 'post') {
  const req =
    method === 'delete'
      ? client.delete(`/fr/admin/users/${userId}`)
      : client.post(`/fr/admin/users/${userId}/${name}`)
  return req.redirects(0).withCsrfToken().header('Accept', 'application/json').loginAs(actor)
}

test.group('Back-office - utilisateurs', (group) => {
  useDatabase(group)

  test('liste les comptes sans jamais exposer le mot de passe', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.create()
    const member = await createMember(organization, 'member')

    const response = await client.get('/fr/admin/users').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/users/index')
    const users: ListedUser[] = response.inertiaProps.users.data
    assert.equal(users.find((u) => u.id === member.id)?.organizationsCount, 1)
    assert.equal(users.find((u) => u.id === admin.id)?.platformRole, 'admin')
    assert.notProperty(users[0], 'password')
  })

  test('recherche partielle et insensible a la casse sur lemail', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await UserFactory.merge({ email: 'Jane.Doe@acme-test.io' }).create()
    await UserFactory.merge({ email: 'autre@exemple.fr' }).create()

    const response = await client
      .get('/fr/admin/users?search=JANE.doe@ACME')
      .withInertia()
      .loginAs(admin)

    const emails = response.inertiaProps.users.data.map((u: ListedUser) => u.email)
    assert.deepEqual(emails, [target.email])
    assert.equal(response.inertiaProps.filters.search, 'JANE.doe@ACME')
  })

  test('les jokers LIKE saisis sont traites litteralement', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await UserFactory.merge({ email: 'abc@exemple.fr' }).create()

    const response = await client.get('/fr/admin/users?search=%25').withInertia().loginAs(admin)

    assert.lengthOf(response.inertiaProps.users.data, 0)
  })

  test('signale les emails non verifies', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const pending = await UserFactory.apply('unverified').create()

    const response = await client
      .get(`/fr/admin/users?search=${encodeURIComponent(pending.email)}`)
      .withInertia()
      .loginAs(admin)

    assert.isFalse(response.inertiaProps.users.data[0].emailVerified)
  })

  test('un utilisateur ordinaire reçoit un 403', async ({ client }) => {
    const user = await createMember(await OrganizationFactory.create(), 'owner')

    const response = await client.get('/fr/admin/users').withInertia().loginAs(user)

    response.assertStatus(403)
  })
})

/**
 * Gestion des utilisateurs par la plateforme (#160) : fiche, filtres, actions.
 */

test.group('Gestion utilisateurs - fiche (#160)', (group) => {
  useDatabase(group)

  test('la fiche affiche identite, organisations et passkeys', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { owner } = await createOrganizationWithOwner({ name: 'Test Org' })
    await PasskeyFactory.merge({ userId: owner.id, name: 'YubiKey' }).create()

    const { account: user } = await userShow(client, admin, owner.id)

    assert.equal(user.email, owner.email)
    assert.lengthOf(user.organizations, 1)
    assert.equal(user.organizations[0].name, 'Test Org')
    assert.equal(user.organizations[0].roleSlug, 'owner')
    assert.lengthOf(user.passkeys, 1)
    assert.equal(user.passkeys[0].name, 'YubiKey')
  })

  test('la fiche affiche les consentements legaux', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization, owner } = await createOrganizationWithOwner()
    await LegalConsentFactory.merge({
      userId: owner.id,
      organizationId: organization.id,
      kind: 'terms',
    }).create()

    const { account: user } = await userShow(client, admin, owner.id)

    assert.lengthOf(user.consents, 1)
    assert.equal(user.consents[0].kind, 'terms')
    assert.equal(user.consents[0].organizationName, organization.name)
  })

  test('isSelf est true pour son propre compte', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const { account: user } = await userShow(client, admin, admin.id)

    assert.isTrue(user.isSelf)
    assert.isTrue(user.canSupport)
    assert.isTrue(user.canManage)
  })

  test('un utilisateur inconnu renvoie 404', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client.get('/fr/admin/users/999999').withInertia().loginAs(admin)

    response.assertStatus(404)
  })
})

test.group('Gestion utilisateurs - filtres (#160)', (group) => {
  useDatabase(group)

  test('filtre par rôle plateforme', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const support = await UserFactory.apply('platformSupport').create()
    await UserFactory.create() // none

    const onlySupport = await userList(client, admin, '?platformRole=support')
    assert.deepEqual(
      onlySupport.users.data.map((u) => u.id),
      [support.id]
    )

    const anyRole = await userList(client, admin, '?platformRole=any-role')
    assert.sameMembers(
      anyRole.users.data.map((u) => u.id),
      [admin.id, support.id]
    )
  })

  test('filtre par verification email', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const unverified = await UserFactory.apply('unverified').create()

    const onlyVerified = await userList(client, admin, '?emailVerified=verified')
    assert.notInclude(
      onlyVerified.users.data.map((u) => u.id),
      unverified.id
    )

    const onlyUnverified = await userList(client, admin, '?emailVerified=unverified')
    assert.deepEqual(
      onlyUnverified.users.data.map((u) => u.id),
      [unverified.id]
    )
  })

  test('filtre par activite recente', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const recent = await UserFactory.merge({
      lastLoginAt: DateTime.now().minus({ days: 5 }),
    }).create()
    const never = await UserFactory.merge({ lastLoginAt: null }).create()

    const onlyRecent = await userList(client, admin, '?activity=recent')
    assert.include(
      onlyRecent.users.data.map((u) => u.id),
      recent.id
    )
    assert.notInclude(
      onlyRecent.users.data.map((u) => u.id),
      never.id
    )

    const onlyNever = await userList(client, admin, '?activity=never')
    assert.include(
      onlyNever.users.data.map((u) => u.id),
      never.id
    )
  })

  test('filtre par type dorganisation', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const supplierMember = await createMember(supplier, 'owner')
    const buyer = await OrganizationFactory.create()
    const buyerMember = await createMember(buyer, 'owner')

    const onlySuppliers = await userList(client, admin, '?organizationType=supplier')
    assert.include(
      onlySuppliers.users.data.map((u) => u.id),
      supplierMember.id
    )
    assert.notInclude(
      onlySuppliers.users.data.map((u) => u.id),
      buyerMember.id
    )
  })

  test('filtre par statut de suspension', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const suspended = await UserFactory.merge({
      suspendedAt: DateTime.now(),
    }).create()
    const active = await UserFactory.create()

    const onlySuspended = await userList(client, admin, '?status=suspended')
    assert.include(
      onlySuspended.users.data.map((u) => u.id),
      suspended.id
    )
    assert.notInclude(
      onlySuspended.users.data.map((u) => u.id),
      active.id
    )

    const onlyActive = await userList(client, admin, '?status=active')
    assert.notInclude(
      onlyActive.users.data.map((u) => u.id),
      suspended.id
    )
  })

  test('une valeur de filtre invalide est refusee', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client
      .get('/fr/admin/users?platformRole=superuser')
      .header('Accept', 'application/json')
      .loginAs(admin)

    response.assertStatus(422)
  })

  test('une page invalide est refusee', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    for (const page of ['1.5', '0', '999999999']) {
      const response = await client
        .get(`/fr/admin/users?page=${page}`)
        .header('Accept', 'application/json')
        .loginAs(admin)
      response.assertStatus(422)
    }
  })
})

test.group('Gestion utilisateurs - droits (#160)', (group) => {
  useDatabase(group)

  test('seul ladmin suspend ou supprime', async ({ client, assert }) => {
    const target = await UserFactory.create()
    for (const role of ['platformSupport', 'platformModerator', 'platformAnalyst'] as const) {
      const user = await UserFactory.apply(role).create()
      const suspend = await userAction(client, user, target.id, 'suspend')
      suspend.assertStatus(403)
      const destroy = await userAction(client, user, target.id, '', 'delete')
      destroy.assertStatus(403)
    }
    await target.refresh()
    assert.isNull(target.suspendedAt)
  })

  test('admin et support renvoient la verification et reinitialisent le mot de passe', async ({
    client,
    assert,
  }) => {
    const target = await UserFactory.apply('unverified').create()

    // Sans faux mailer, l'envoi tenterait une vraie connexion SMTP (30 s).
    mail.fake()
    try {
      for (const role of ['platformAdmin', 'platformSupport'] as const) {
        const user = await UserFactory.apply(role).create()
        const resend = await userAction(client, user, target.id, 'resend-verification')
        assert.notEqual(resend.status(), 403)
        const reset = await userAction(client, user, target.id, 'password-reset')
        assert.notEqual(reset.status(), 403)
      }

      for (const role of ['platformModerator', 'platformAnalyst'] as const) {
        const user = await UserFactory.apply(role).create()
        const resend = await userAction(client, user, target.id, 'resend-verification')
        resend.assertStatus(403)
        const reset = await userAction(client, user, target.id, 'password-reset')
        reset.assertStatus(403)
      }
    } finally {
      mail.restore()
    }
  })
})

test.group('Gestion utilisateurs - suspension (#160)', (group) => {
  useDatabase(group)

  test('suspendre un compte pose suspendedAt et trace laction', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await UserFactory.create()

    const response = await userAction(client, admin, target.id, 'suspend')

    response.assertStatus(302)
    await target.refresh()
    assert.isNotNull(target.suspendedAt)

    const [log] = await AdminAuditLog.query().where('action', 'user.suspended')
    assert.equal(log.targetId, target.id)
    assert.equal(log.actorUserId, admin.id)
  })

  test('le motif de suspension est enregistre dans laudit', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await UserFactory.create()

    await client
      .post(`/fr/admin/users/${target.id}/suspend`)
      .redirects(0)
      .withCsrfToken()
      .json({ reason: 'Abus signale' })
      .loginAs(admin)

    const [log] = await AdminAuditLog.query().where('action', 'user.suspended')
    assert.equal(log.changes?.after?.reason, 'Abus signale')
  })

  test('un compte suspendu ne peut plus se connecter', async ({ client }) => {
    const target = await UserFactory.merge({ suspendedAt: DateTime.now() }).create()

    const response = await client
      .post('/fr/login')
      .redirects(0)
      .withCsrfToken()
      .json({ email: target.email, password: TEST_PASSWORD })

    // Redirection back avec erreur flash
    response.assertStatus(302)
  })

  test('on ne peut pas suspendre son propre compte', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await userAction(client, admin, admin.id, 'suspend')

    response.assertStatus(302)
    await admin.refresh()
    assert.isNull(admin.suspendedAt)
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('on ne peut pas suspendre un autre admin plateforme', async ({ client, assert }) => {
    const admin1 = await UserFactory.apply('platformAdmin').create()
    const admin2 = await UserFactory.apply('platformAdmin').create()

    const response = await userAction(client, admin1, admin2.id, 'suspend')

    response.assertStatus(302)
    await admin2.refresh()
    assert.isNull(admin2.suspendedAt)
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('suspendre un compte deja suspendu renvoie une erreur', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await UserFactory.merge({ suspendedAt: DateTime.now() }).create()

    const response = await userAction(client, admin, target.id, 'suspend')

    response.assertStatus(302)
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })
})

test.group('Gestion utilisateurs - reactivation (#160)', (group) => {
  useDatabase(group)

  test('reactiver un compte retire suspendedAt et trace laction', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await UserFactory.merge({ suspendedAt: DateTime.now() }).create()

    const response = await userAction(client, admin, target.id, 'reactivate')

    response.assertStatus(302)
    await target.refresh()
    assert.isNull(target.suspendedAt)

    const [log] = await AdminAuditLog.query().where('action', 'user.reactivated')
    assert.equal(log.targetId, target.id)
  })

  test('reactiver un compte actif renvoie une erreur', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await UserFactory.create()

    const response = await userAction(client, admin, target.id, 'reactivate')

    response.assertStatus(302)
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })
})

test.group('Gestion utilisateurs - support (#160)', (group) => {
  useDatabase(group)

  test('renvoyer la verification met en file un mail et trace laction', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await UserFactory.apply('unverified').create()

    const { mails } = mail.fake()
    try {
      const response = await userAction(client, admin, target.id, 'resend-verification')
      response.assertStatus(302)

      assert.lengthOf(
        mails.sent((m) => m instanceof EmailVerificationNotification),
        1
      )

      const [log] = await AdminAuditLog.query().where('action', 'user.verification_resent')
      assert.equal(log.targetId, target.id)
    } finally {
      mail.restore()
    }
  })

  test('renvoyer a un compte verifie renvoie une erreur', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await UserFactory.create()

    const response = await userAction(client, admin, target.id, 'resend-verification')

    response.assertStatus(302)
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('reinitialiser le mot de passe met en file un mail et trace laction', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await UserFactory.create()

    const { mails } = mail.fake()
    try {
      const response = await userAction(client, admin, target.id, 'password-reset')
      response.assertStatus(302)

      assert.lengthOf(
        mails.sent((m) => m instanceof PasswordResetNotification),
        1
      )

      const [log] = await AdminAuditLog.query().where('action', 'user.password_reset_requested')
      assert.equal(log.targetId, target.id)
    } finally {
      mail.restore()
    }
  })
})

test.group('Gestion utilisateurs - suppression RGPD (#160)', (group) => {
  useDatabase(group)

  test('supprimer anonymise le compte et trace laction', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await UserFactory.merge({
      email: 'to-delete@example.com',
      firstName: 'John',
      lastName: 'Doe',
    }).create()

    const response = await userAction(client, admin, target.id, '', 'delete')

    response.assertStatus(302)
    await target.refresh()
    assert.include(target.email, 'deleted-')
    assert.include(target.email, '.invalid')
    assert.isNull(target.firstName)
    assert.isNull(target.lastName)

    const [log] = await AdminAuditLog.query().where('action', 'user.deleted')
    assert.equal(log.targetId, target.id)
    assert.notInclude(JSON.stringify(log.changes), 'to-delete@example.com')
  })

  test('supprimer retire les adhesions et les passkeys', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization, owner } = await createOrganizationWithOwner()
    await createMember(organization, 'owner')
    await PasskeyFactory.merge({ userId: owner.id }).create()

    await userAction(client, admin, owner.id, '', 'delete')

    const memberships = await owner.related('organizationUsers').query()
    const passkeys = await owner.related('passkeys').query()
    assert.lengthOf(memberships, 0)
    assert.lengthOf(passkeys, 0)
  })

  test('on ne peut pas supprimer son propre compte', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const originalEmail = admin.email

    const response = await userAction(client, admin, admin.id, '', 'delete')

    response.assertStatus(302)
    await admin.refresh()
    assert.equal(admin.email, originalEmail)
  })

  test('on ne peut pas supprimer un admin plateforme', async ({ client, assert }) => {
    const admin1 = await UserFactory.apply('platformAdmin').create()
    const admin2 = await UserFactory.apply('platformAdmin').create()
    const originalEmail = admin2.email

    const response = await userAction(client, admin1, admin2.id, '', 'delete')

    response.assertStatus(302)
    await admin2.refresh()
    assert.equal(admin2.email, originalEmail)
  })

  test('suppression bloquee si dernier owner dune organisation active', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { owner } = await createOrganizationWithOwner({ name: 'Blocking Org' })

    const response = await userAction(client, admin, owner.id, '', 'delete')

    response.assertStatus(302)
    await owner.refresh()
    assert.notInclude(owner.email, 'deleted-')
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('suppression autorisee si lorganisation est archivee', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization, owner } = await createOrganizationWithOwner()
    organization.archivedAt = DateTime.now()
    await organization.save()

    const response = await userAction(client, admin, owner.id, '', 'delete')

    response.assertStatus(302)
    await owner.refresh()
    assert.include(owner.email, 'deleted-')
  })

  test('un compte suspendu peut être supprime', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await UserFactory.merge({ suspendedAt: DateTime.now() }).create()

    const response = await userAction(client, admin, target.id, '', 'delete')

    response.assertStatus(302)
    await target.refresh()
    assert.include(target.email, 'deleted-')
    assert.isNotNull(target.suspendedAt)
  })
})

test.group('Gestion utilisateurs - lastLoginAt (#160)', (group) => {
  useDatabase(group)

  test('lastLoginAt est mis a jour a la connexion par mot de passe', async ({ client, assert }) => {
    const user = await UserFactory.create()
    await user.refresh()
    assert.isNull(user.lastLoginAt)

    await client
      .post('/fr/login')
      .redirects(0)
      .withCsrfToken()
      .json({ email: user.email, password: TEST_PASSWORD })

    await user.refresh()
    assert.isNotNull(user.lastLoginAt)
    const diff = DateTime.now().diff(user.lastLoginAt!, 'seconds').seconds
    assert.isBelow(diff, 60)
  })
})
