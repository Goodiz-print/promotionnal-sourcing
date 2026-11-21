import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import Organization from '#models/organization'
import User from '#models/user'
import LegalConsent from '#models/legal_consent'
import { useDatabase } from '#tests/utils/setup'
import { installFakeVat } from '#tests/utils/fake_vat_verifier'

const VALID = {
  civility: 'madame',
  firstName: 'Marie',
  lastName: 'Dupont',
  email: 'marie@agence.fr',
  password: 'motdepasse10',
  passwordConfirmation: 'motdepasse10',
  companyName: 'Agence Objets & Co',
  country: 'FR',
  taxId: 'FR40303265045',
  website: 'https://agence.fr',
  phone: '+33 1 02 03 04 05',
  activity: 'object_communication_agency',
  locale: 'fr',
  certifiesProfessional: true,
  acceptsTerms: true,
  acceptsPartnerCommunications: false,
}

test.group('Inscription agence', (group) => {
  useDatabase(group, { seed: 'roles' })

  let restoreVat: () => void
  let vat: ReturnType<typeof installFakeVat>['fake']

  group.each.setup(() => {
    mail.fake()
    const installed = installFakeVat('valid')
    vat = installed.fake
    restoreVat = installed.restore
    return () => {
      mail.restore()
      restoreVat()
    }
  })

  const post = (client: any, body: Record<string, unknown> = {}) =>
    client
      .post('/fr/signup/agency')
      .redirects(0)
      .withCsrfToken()
      .json({ ...VALID, ...body })

  test('le formulaire est public', async ({ client }) => {
    const response = await client.get('/fr/signup/agency').withInertia()
    response.assertStatus(200)
    response.assertInertiaComponent('auth/signup_agency')
  })

  test('TVA vérifiée + email au domaine du site : compte actif immédiatement', async ({
    client,
    assert,
  }) => {
    const response = await post(client)

    response.assertStatus(302)
    response.assertHeader('location', '/fr/email/verify')

    const user = await User.findByOrFail('email', 'marie@agence.fr')
    assert.equal(user.civility, 'madame')
    assert.equal(user.firstName, 'Marie')
    assert.isNotNull(user.currentOrganizationId)

    const org = await Organization.query()
      .where('id', user.currentOrganizationId!)
      .preload('agencyProfile')
      .firstOrFail()
    assert.equal(org.organizationType, 'buyer')
    assert.equal(org.name, 'Agence Objets & Co')
    assert.equal(org.vatNumber, 'FR40303265045')
    assert.isNull(org.siret)
    assert.isNotNull(org.vatVerifiedAt)
    assert.isNotNull(org.domainVerifiedAt)
    assert.deepEqual(org.reviewReasons, [])
    assert.equal(org.agencyProfile.activity, 'object_communication_agency')
    assert.deepEqual(vat.calls, [{ countryCode: 'FR', vatNumber: '40303265045' }])
  })

  test('l’email de contact saisi devient celui de l’organisation (#221)', async ({
    client,
    assert,
  }) => {
    await post(client, { contactEmail: 'Contact@Agence.fr ' })

    const user = await User.findByOrFail('email', 'marie@agence.fr')
    const org = await Organization.findOrFail(user.currentOrganizationId)
    assert.equal(org.email, 'Contact@Agence.fr')
    assert.equal(org.phone, '+33 1 02 03 04 05')
  })

  test('sans email de contact, l’organisation n’en a pas', async ({ client, assert }) => {
    await post(client)

    const user = await User.findByOrFail('email', 'marie@agence.fr')
    const org = await Organization.findOrFail(user.currentOrganizationId)
    assert.isNull(org.email)
  })

  test('un email de contact invalide est refusé', async ({ client, assert }) => {
    const response = await post(client, { contactEmail: 'pas-un-email' })

    response.assertStatus(302)
    assert.isNull(await User.findBy('email', 'marie@agence.fr'))
  })

  test('les consentements sont journalisés avec version et IP, sans les communications refusées', async ({
    client,
    assert,
  }) => {
    await post(client)

    const user = await User.findByOrFail('email', 'marie@agence.fr')
    const consents = await LegalConsent.query().where('userId', user.id).orderBy('kind')
    assert.deepEqual(
      consents.map((c) => c.kind),
      ['professional_certification', 'terms']
    )
    assert.isTrue(consents.every((c) => c.version === '2026-10-19' && c.ipAddress !== null))
  })

  test('les communications partenaires cochées sont journalisées', async ({ client, assert }) => {
    await post(client, { acceptsPartnerCommunications: true })

    const consents = await LegalConsent.all()
    const kinds = consents.map((c) => c.kind)
    assert.include(kinds, 'partner_communications')
  })

  test('un SIRET est conservé comme SIRET et contrôlé via la TVA française dérivée', async ({
    client,
    assert,
  }) => {
    await post(client, { taxId: '356 000 000 00048' })

    const org = await Organization.findByOrFail('name', 'Agence Objets & Co')
    assert.equal(org.siret, '35600000000048')
    assert.isNull(org.vatNumber)
    assert.equal(vat.calls[0].countryCode, 'FR')
  })

  test('un email grand public passe en validation manuelle, le compte est quand même créé', async ({
    client,
    assert,
  }) => {
    const response = await post(client, { email: 'marie@gmail.com' })

    response.assertStatus(302)
    const org = await Organization.findByOrFail('name', 'Agence Objets & Co')
    assert.deepEqual(org.reviewReasons, ['free_email_domain'])
    assert.isNull(org.domainVerifiedAt)
  })

  test('domaine différent du site, absence de site, activité « autre » et TVA non vérifiée : motifs cumulés', async ({
    client,
    assert,
  }) => {
    vat.status = 'unavailable'
    await post(client, {
      email: 'marie@autre.fr',
      website: null,
      activity: 'other',
      activityOther: 'Cadeaux d’affaires',
    })

    const org = await Organization.findByOrFail('name', 'Agence Objets & Co')
    assert.sameMembers(org.reviewReasons, ['vat_unverified', 'other_activity', 'no_website'])
    assert.isNull(org.vatVerifiedAt)
  })

  test('domaine de l’email différent de celui du site → domain_mismatch', async ({
    client,
    assert,
  }) => {
    await post(client, { email: 'marie@autre.fr' })

    const org = await Organization.findByOrFail('name', 'Agence Objets & Co')
    assert.deepEqual(org.reviewReasons, ['domain_mismatch'])
  })

  test('refus sans créer de compte : cases juridiques, activité « autre » sans précision, TVA illisible, email pris', async ({
    client,
    assert,
  }) => {
    await post(client, { acceptsTerms: false })
    await post(client, { certifiesProfessional: false })
    await post(client, { activity: 'other' })
    await post(client, { taxId: '12345' })
    await post(client, { password: 'court', passwordConfirmation: 'court' })

    assert.lengthOf(await User.all(), 0)
    assert.lengthOf(vat.calls, 0)
  })

  test('un email déjà inscrit est refusé et ne crée pas de seconde organisation', async ({
    client,
    assert,
  }) => {
    await post(client)
    await post(client, { companyName: 'Autre agence' })

    assert.lengthOf(await Organization.all(), 1)
    assert.lengthOf(await User.all(), 1)
  })
})
