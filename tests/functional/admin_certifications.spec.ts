import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import { CertificationFactory } from '#database/factories/certification_factory'
import { CertificationTranslationFactory } from '#database/factories/certification_translation_factory'
import { ProductFactory } from '#database/factories/product_factory'
import type User from '#models/user'
import Certification from '#models/certification'
import CertificationTranslation from '#models/certification_translation'
import AdminAuditLog from '#models/admin_audit_log'
import TranslationQueueService from '#services/translation_queue_service'
import SearchSyncService from '#services/search_sync_service'
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
      const create = await client.get('/fr/admin/certifications/new').withInertia().loginAs(user)
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

  test('le slug doit etre unique', async ({ client, assert }) => {
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

    // Erreur de validation : redirection Inertia avec les erreurs en session.
    response.assertStatus(302)
    assert.lengthOf(await Certification.query().where('slug', 'unique-slug'), 1)
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

// ─────────────────────────────────────────────────────────────────────────────
// No-op et effets de bord
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cree un espion pour TranslationQueueService.
 */
function createTranslationQueueSpy() {
  const queueCalls: Array<{ entity: string; entityId: number; sourceLocale: string }> = []
  const spy = {
    async queue(entity: string, entityId: number, sourceLocale: string) {
      queueCalls.push({ entity, entityId, sourceLocale })
      return true
    },
  } as unknown as TranslationQueueService
  return { spy, queueCalls }
}

/**
 * Cree un espion pour SearchSyncService.
 */
function createSearchSyncSpy() {
  const productIds: number[] = []
  const spy = {
    async queueProduct(productId: number) {
      productIds.push(productId)
    },
    async queueOrganization() {},
    async queueSettings() {},
  } as unknown as SearchSyncService
  return { spy, productIds }
}

test.group('Administration des certifications - no-op', (group) => {
  useDatabase(group)

  test('mise a jour sans changement ne cree pas de log audit ni de file de traduction', async ({
    client,
    assert,
  }) => {
    const admin = await platformAdmin()
    const cert = await CertificationFactory.merge({
      domain: 'textile',
      isEco: true,
      sourceLocale: 'fr',
    }).create()
    await CertificationTranslationFactory.merge({
      certificationId: cert.id,
      locale: 'fr',
      name: 'Test',
    }).create()

    const auditCountBefore = await AdminAuditLog.query()
      .where('targetType', 'certification')
      .where('targetId', cert.id)
      .where('action', 'certification.updated')
      .count('* as total')
      .first()
    const countBefore = Number(auditCountBefore?.$extras.total ?? 0)

    const { spy, queueCalls } = createTranslationQueueSpy()
    app.container.swap(TranslationQueueService, () => spy)

    try {
      // Reenvoyer les memes valeurs
      const response = await client
        .patch(`/fr/admin/certifications/${cert.id}`)
        .withInertia()
        .withCsrfToken()
        .loginAs(admin)
        .json({
          domain: 'textile',
          isEco: true,
          sourceLocale: 'fr',
          translations: { fr: { name: 'Test' } },
        })

      response.assertStatus(200)

      // Pas de nouveau log audit
      const auditCountAfter = await AdminAuditLog.query()
        .where('targetType', 'certification')
        .where('targetId', cert.id)
        .where('action', 'certification.updated')
        .count('* as total')
        .first()
      const countAfter = Number(auditCountAfter?.$extras.total ?? 0)
      assert.equal(countAfter, countBefore, 'Aucun log audit ne doit etre cree pour un no-op')

      // Pas d'appel a la file de traduction
      assert.lengthOf(queueCalls, 0, 'La file de traduction ne doit pas etre appelee pour un no-op')
    } finally {
      app.container.restore(TranslationQueueService)
    }
  })
})

test.group('Administration des certifications - reindexation', (group) => {
  useDatabase(group)

  test('changement de isEco reindexe les produits par lots', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const cert = await CertificationFactory.merge({
      domain: 'textile',
      isEco: false,
      sourceLocale: 'fr',
    }).create()
    await CertificationTranslationFactory.merge({
      certificationId: cert.id,
      locale: 'fr',
      name: 'Test Reindex',
    }).create()

    // Creer des produits avec cette certification
    const products = await ProductFactory.createMany(5)
    for (const product of products) {
      await db.table('product_certifications').insert({
        product_id: product.id,
        certification_id: cert.id,
      })
    }

    const { spy, productIds } = createSearchSyncSpy()
    app.container.swap(SearchSyncService, () => spy)

    try {
      const response = await client
        .patch(`/fr/admin/certifications/${cert.id}`)
        .withInertia()
        .withCsrfToken()
        .loginAs(admin)
        .json({
          isEco: true,
          translations: { fr: { name: 'Test Reindex' } },
        })

      response.assertStatus(200)

      // Tous les produits doivent avoir ete reindexes
      assert.lengthOf(productIds, products.length, 'Tous les produits doivent etre reindexes')
      for (const product of products) {
        assert.include(productIds, product.id, `Le produit ${product.id} doit etre reindexe`)
      }
    } finally {
      app.container.restore(SearchSyncService)
    }
  })
})
