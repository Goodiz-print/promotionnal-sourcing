import { test } from '@japa/runner'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import { CertificationFactory } from '#database/factories/certification_factory'
import { CertificationTranslationFactory } from '#database/factories/certification_translation_factory'
import type User from '#models/user'
import Certification from '#models/certification'
import CertificationTranslation from '#models/certification_translation'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type { RoleSlug } from '#shared/types/role'

/**
 * Membre d'une organisation acheteuse fraiche : prouve que le role d'organisation
 * n'ouvre pas l'administration des certifications.
 */
function freshOrgMember(roleSlug: RoleSlug = 'owner'): Promise<User> {
  return OrganizationFactory.create().then((organization) => createMember(organization, roleSlug))
}

function platformAdmin(): Promise<User> {
  return UserFactory.apply('platformAdmin').create()
}

const OEKO_TEX = {
  slug: 'oeko-tex-100-test',
  domain: 'textile',
  isEco: true,
  sourceLocale: 'fr',
  translations: { fr: { name: 'OEKO-TEX 100' }, en: { name: 'OEKO-TEX 100' } },
}

test.group('Administration des certifications - ACL', (group) => {
  useDatabase(group)

  test('un admin plateforme voit la liste des certifications', async ({ client }) => {
    const admin = await platformAdmin()
    const cert = await CertificationFactory.create()
    await CertificationTranslationFactory.merge({ certificationId: cert.id, locale: 'fr' }).create()

    const response = await client.get('/fr/admin/certifications').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/certifications/index')
  })

  for (const roleSlug of ['owner', 'admin', 'manager', 'member'] as const) {
    test(`un ${roleSlug} d'organisation ordinaire ne peut pas gerer les certifications (403)`, async ({
      client,
      assert,
    }) => {
      const user = await freshOrgMember(roleSlug)
      const cert = await CertificationFactory.create()
      await CertificationTranslationFactory.merge({
        certificationId: cert.id,
        locale: 'fr',
      }).create()

      const list = await client.get('/fr/admin/certifications').withInertia().loginAs(user)
      const create = await client.get('/fr/admin/certifications/create').withInertia().loginAs(user)
      assert.equal(list.status(), 403)
      assert.equal(create.status(), 403)

      // Ecritures refusees
      const store = await client
        .post('/fr/admin/certifications')
        .redirects(0)
        .withCsrfToken()
        .loginAs(user)
        .json(OEKO_TEX)
      const destroy = await client
        .delete(`/fr/admin/certifications/${cert.id}`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(user)
      assert.isAtLeast(store.status(), 302)
      assert.isAtLeast(destroy.status(), 302)
      assert.isNull(await Certification.findBy('slug', OEKO_TEX.slug))
      assert.isNotNull(await Certification.find(cert.id))
    })
  }

  test('un visiteur anonyme est renvoye vers la connexion', async ({ client }) => {
    const response = await client.get('/fr/admin/certifications').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })
})

test.group('Administration des certifications - CRUD', (group) => {
  useDatabase(group)

  test("creation d'une certification avec ses traductions", async ({ client, assert }) => {
    const admin = await platformAdmin()

    const response = await client
      .post('/fr/admin/certifications')
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)
      .json(OEKO_TEX)

    // Redirection vers l'ecran d'edition
    response.assertStatus(200)
    response.assertInertiaComponent('admin/certifications/edit')

    const cert = await Certification.findByOrFail('slug', OEKO_TEX.slug)
    assert.equal(cert.domain, 'textile')
    assert.isTrue(cert.isEco)
    assert.equal(cert.sourceLocale, 'fr')

    const fr = await CertificationTranslation.query()
      .where('certificationId', cert.id)
      .where('locale', 'fr')
      .firstOrFail()
    assert.equal(fr.name, 'OEKO-TEX 100')
    assert.isFalse(fr.isAuto)
  })

  test('le slug doit etre unique', async ({ client }) => {
    const admin = await platformAdmin()
    const existing = await CertificationFactory.merge({ slug: 'unique-slug' }).create()
    await CertificationTranslationFactory.merge({
      certificationId: existing.id,
      locale: 'fr',
    }).create()

    const response = await client
      .post('/fr/admin/certifications')
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)
      .json({ ...OEKO_TEX, slug: 'unique-slug' })

    response.assertStatus(422)
  })

  test("mise a jour d'une certification", async ({ client, assert }) => {
    const admin = await platformAdmin()
    const cert = await CertificationFactory.merge({ isEco: false, domain: 'textile' }).create()
    await CertificationTranslationFactory.merge({
      certificationId: cert.id,
      locale: 'fr',
      name: 'Original',
    }).create()

    const response = await client
      .patch(`/fr/admin/certifications/${cert.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)
      .json({
        domain: 'environment',
        isEco: true,
        translations: { fr: { name: 'Mis a jour' } },
      })

    response.assertStatus(200)
    await cert.refresh()
    assert.equal(cert.domain, 'environment')
    assert.isTrue(cert.isEco)

    const fr = await CertificationTranslation.query()
      .where('certificationId', cert.id)
      .where('locale', 'fr')
      .firstOrFail()
    assert.equal(fr.name, 'Mis a jour')
  })

  test("suppression d'une certification non utilisee", async ({ client, assert }) => {
    const admin = await platformAdmin()
    const cert = await CertificationFactory.create()
    await CertificationTranslationFactory.merge({ certificationId: cert.id, locale: 'fr' }).create()

    const response = await client
      .delete(`/fr/admin/certifications/${cert.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(200)
    assert.isNull(await Certification.find(cert.id))
  })
})
