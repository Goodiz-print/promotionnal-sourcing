import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { OrganizationInvitationFactory } from '#database/factories/organization_invitation_factory'
import { UserFactory, TEST_PASSWORD } from '#database/factories/user_factory'
import EmailVerificationNotification from '#mails/email_verification_notification'
import OrganizationInvitation from '#models/organization_invitation'
import OrganizationUser from '#models/organization_user'
import Rfq from '#models/rfq'
import User from '#models/user'
import { createMember, createOrganizationWithOwner } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

async function canLogin(email: string, password: string) {
  return User.verifyCredentials(email, password).then(
    () => true,
    () => false
  )
}

test.group('Mon compte — profil', (group) => {
  useDatabase(group)

  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    return () => mail.restore()
  })

  test('la page exige une connexion', async ({ client }) => {
    const response = await client.get('/fr/account').redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', `/fr/login?redirect=${encodeURIComponent('/fr/account')}`)
  })

  test('la page est accessible à un compte non vérifié, sans exposer le mot de passe', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.apply('unverified').create()

    const response = await client.get('/fr/account').loginAs(user).withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('account/show')
    response.assertInertiaPropsContains({
      account: { email: user.email, isEmailVerified: false },
      blockingOrganizations: [],
    })
    assert.notProperty(response.inertiaProps.account as object, 'password')
  })

  test('modifie le nom et la langue sans toucher à la vérification', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const response = await client
      .patch('/fr/account')
      .loginAs(user)
      .redirects(0)
      .withCsrfToken()
      .json({ firstName: 'Nouveau', lastName: 'Nom', email: user.email, locale: 'en' })

    response.assertStatus(302)
    response.assertHeader('location', '/en/account')
    await user.refresh()
    assert.equal(user.firstName, 'Nouveau')
    assert.equal(user.lastName, 'Nom')
    assert.equal(user.fullName, 'Nouveau Nom')
    assert.equal(user.locale, 'en')
    assert.isNotNull(user.emailVerifiedAt)
    fakeMailer.mails.assertNoneSent()
  })

  test('changer d’email remet le compte en non vérifié et envoie le mail à la nouvelle adresse', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()

    const response = await client
      .patch('/fr/account')
      .loginAs(user)
      .redirects(0)
      .withCsrfToken()
      .json({
        firstName: user.firstName,
        lastName: user.lastName,
        email: 'Nouvelle@Example.com',
        locale: 'fr',
      })

    response.assertStatus(302)
    response.assertHeader('location', '/fr/email/verify')
    await user.refresh()
    assert.equal(user.email, 'Nouvelle@Example.com')
    assert.isNull(user.emailVerifiedAt)
    fakeMailer.mails.assertSent(EmailVerificationNotification, (sent) => {
      return (sent as unknown as { email: string }).email === 'Nouvelle@Example.com'
    })
  })

  test('refuse un email déjà pris (insensible à la casse), accepte le sien', async ({
    client,
    assert,
  }) => {
    await UserFactory.merge({ email: 'pris@example.com' }).create()
    const user = await UserFactory.merge({ email: 'moi@example.com' }).create()

    const taken = await client
      .patch('/fr/account')
      .loginAs(user)
      .redirects(0)
      .withCsrfToken()
      .withInertia()
      .json({ firstName: 'Moi', lastName: 'Même', email: 'PRIS@example.com', locale: 'fr' })
    // Échec de validation d'une requête Inertia : redirection 303 vers la page.
    taken.assertStatus(303)
    await user.refresh()
    assert.equal(user.email, 'moi@example.com')

    const own = await client
      .patch('/fr/account')
      .loginAs(user)
      .redirects(0)
      .withCsrfToken()
      .json({ firstName: 'Moi', lastName: 'Même', email: 'MOI@example.com', locale: 'fr' })
    own.assertHeader('location', '/fr/account')
    fakeMailer.mails.assertNoneSent()
  })
})

test.group('Mon compte — mot de passe', (group) => {
  useDatabase(group)

  test('change le mot de passe avec le mot de passe actuel', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const response = await client
      .patch('/fr/account/password')
      .loginAs(user)
      .redirects(0)
      .withCsrfToken()
      .json({
        currentPassword: TEST_PASSWORD,
        password: 'nouveau-mdp-1',
        passwordConfirmation: 'nouveau-mdp-1',
      })

    response.assertStatus(302)
    assert.isTrue(await canLogin(user.email, 'nouveau-mdp-1'))
    assert.isFalse(await canLogin(user.email, TEST_PASSWORD))
  })

  test('refuse un mot de passe actuel incorrect', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const response = await client
      .patch('/fr/account/password')
      .loginAs(user)
      .redirects(0)
      .withCsrfToken()
      .json({
        currentPassword: 'mauvais-mdp',
        password: 'nouveau-mdp-1',
        passwordConfirmation: 'nouveau-mdp-1',
      })

    response.assertStatus(302)
    assert.isTrue(await canLogin(user.email, TEST_PASSWORD))
    assert.isFalse(await canLogin(user.email, 'nouveau-mdp-1'))
  })

  test('refuse un nouveau mot de passe identique à l’ancien ou mal confirmé', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()

    for (const body of [
      { password: TEST_PASSWORD, passwordConfirmation: TEST_PASSWORD },
      { password: 'nouveau-mdp-1', passwordConfirmation: 'autre-chose-22' },
      { password: 'court', passwordConfirmation: 'court' },
    ]) {
      await client
        .patch('/fr/account/password')
        .loginAs(user)
        .redirects(0)
        .withCsrfToken()
        .json({ currentPassword: TEST_PASSWORD, ...body })
    }

    assert.isTrue(await canLogin(user.email, TEST_PASSWORD))
    assert.isFalse(await canLogin(user.email, 'nouveau-mdp-1'))
  })
})

test.group('Mon compte — suppression (anonymisation)', (group) => {
  useDatabase(group)

  test('refuse un mot de passe incorrect : rien ne change', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const response = await client
      .delete('/fr/account')
      .loginAs(user)
      .redirects(0)
      .withCsrfToken()
      .json({ currentPassword: 'mauvais-mdp' })

    response.assertStatus(302)
    await user.refresh()
    assert.notMatch(user.email, /anonymized\.invalid$/)
  })

  test('refuse la suppression du dernier owner d’une organisation active', async ({
    client,
    assert,
  }) => {
    const { owner, organization } = await createOrganizationWithOwner({ name: 'Acme' })

    const page = await client.get('/fr/account').loginAs(owner).withInertia()
    page.assertInertiaPropsContains({ blockingOrganizations: ['Acme'] })

    const response = await client
      .delete('/fr/account')
      .loginAs(owner)
      .redirects(0)
      .withCsrfToken()
      .json({ currentPassword: TEST_PASSWORD })

    response.assertStatus(302)
    await owner.refresh()
    assert.notMatch(owner.email, /anonymized\.invalid$/)
    const memberships = await OrganizationUser.query().where('organizationId', organization.id)
    assert.lengthOf(memberships, 1)
  })

  test('autorise le dernier owner d’une organisation archivée', async ({ client, assert }) => {
    const organization = await OrganizationFactory.apply('archived').create()
    const owner = await createMember(organization, 'owner')

    const response = await client
      .delete('/fr/account')
      .loginAs(owner)
      .redirects(0)
      .withCsrfToken()
      .json({ currentPassword: TEST_PASSWORD })

    response.assertStatus(302)
    await owner.refresh()
    assert.match(owner.email, /^deleted-\d+@anonymized\.invalid$/)
  })

  test('anonymise le compte, retire ses adhésions et conserve les demandes de devis', async ({
    client,
    assert,
  }) => {
    const { organization } = await createOrganizationWithOwner()
    const member = await createMember(organization, 'member', {
      email: 'membre@example.com',
      firstName: 'Marie',
      lastName: 'Membre',
    })
    const rfq = await Rfq.create({
      buyerOrganizationId: organization.id,
      title: 'Tote bags',
      createdByUserId: member.id,
    })
    await OrganizationInvitationFactory.merge({
      organizationId: organization.id,
      email: 'Membre@example.com',
    }).create()

    const response = await client
      .delete('/fr/account')
      .loginAs(member)
      .redirects(0)
      .withCsrfToken()
      .json({ currentPassword: TEST_PASSWORD })

    response.assertStatus(302)
    response.assertHeader('location', '/fr')

    await member.refresh()
    assert.equal(member.email, `deleted-${member.id}@anonymized.invalid`)
    assert.isNull(member.fullName)
    assert.isNull(member.firstName)
    assert.isNull(member.lastName)
    assert.isNull(member.currentOrganizationId)
    assert.isNull(member.emailVerifiedAt)
    assert.isFalse(await canLogin('membre@example.com', TEST_PASSWORD))
    assert.isFalse(await canLogin(member.email, TEST_PASSWORD))

    assert.lengthOf(await OrganizationUser.query().where('userId', member.id), 0)
    assert.lengthOf(await OrganizationInvitation.query().where('email', 'Membre@example.com'), 0)

    await rfq.refresh()
    assert.equal(rfq.createdByUserId, member.id)
  })

  test('libère l’adresse : un nouveau compte peut la réutiliser', async ({ client, assert }) => {
    const { organization } = await createOrganizationWithOwner()
    const member = await createMember(organization, 'member', { email: 'reuse@example.com' })

    await client
      .delete('/fr/account')
      .loginAs(member)
      .redirects(0)
      .withCsrfToken()
      .json({ currentPassword: TEST_PASSWORD })

    const again = await UserFactory.merge({ email: 'reuse@example.com' }).create()
    assert.notEqual(again.id, member.id)
  })
})
