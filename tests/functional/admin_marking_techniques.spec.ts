import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import { MarkingTechniqueFactory } from '#database/factories/marking_technique_factory'
import { MarkingTechniqueTranslationFactory } from '#database/factories/marking_technique_translation_factory'
import type User from '#models/user'
import MarkingTechnique from '#models/marking_technique'
import MarkingTechniqueTranslation from '#models/marking_technique_translation'
import AdminAuditLog from '#models/admin_audit_log'
import TranslationQueueService from '#services/translation_queue_service'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type { RoleSlug } from '#shared/types/role'

/**
 * Membre d'une organisation acheteuse fraiche : prouve que le role d'organisation
 * n'ouvre pas l'administration des techniques de marquage.
 */
function freshOrgMember(roleSlug: RoleSlug = 'owner'): Promise<User> {
  return OrganizationFactory.create().then((organization) => createMember(organization, roleSlug))
}

function platformAdmin(): Promise<User> {
  return UserFactory.apply('platformAdmin').create()
}

const SCREEN_PRINT = {
  slug: 'screen-printing-test',
  family: 'print',
  sourceLocale: 'fr',
  translations: { fr: { name: 'Serigraphie' }, en: { name: 'Screen printing' } },
}

test.group('Administration des techniques de marquage - ACL', (group) => {
  useDatabase(group)

  test('un admin plateforme voit la liste des techniques', async ({ client }) => {
    const admin = await platformAdmin()
    const technique = await MarkingTechniqueFactory.create()
    await MarkingTechniqueTranslationFactory.merge({
      markingTechniqueId: technique.id,
      locale: 'fr',
    }).create()

    const response = await client.get('/fr/admin/marking-techniques').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/marking_techniques/index')
  })

  for (const roleSlug of ['owner', 'admin', 'manager', 'member'] as const) {
    test(`un ${roleSlug} d'organisation ordinaire ne peut pas gerer les techniques (403)`, async ({
      client,
      assert,
    }) => {
      const user = await freshOrgMember(roleSlug)
      const technique = await MarkingTechniqueFactory.create()
      await MarkingTechniqueTranslationFactory.merge({
        markingTechniqueId: technique.id,
        locale: 'fr',
      }).create()

      const list = await client.get('/fr/admin/marking-techniques').withInertia().loginAs(user)
      const create = await client
        .get('/fr/admin/marking-techniques/new')
        .withInertia()
        .loginAs(user)
      assert.equal(list.status(), 403)
      assert.equal(create.status(), 403)

      // Ecritures refusees
      const store = await client
        .post('/fr/admin/marking-techniques')
        .redirects(0)
        .withCsrfToken()
        .loginAs(user)
        .json(SCREEN_PRINT)
      const destroy = await client
        .delete(`/fr/admin/marking-techniques/${technique.id}`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(user)
      assert.isAtLeast(store.status(), 302)
      assert.isAtLeast(destroy.status(), 302)
      assert.isNull(await MarkingTechnique.findBy('slug', SCREEN_PRINT.slug))
      assert.isNotNull(await MarkingTechnique.find(technique.id))
    })
  }

  test('un visiteur anonyme est renvoye vers la connexion', async ({ client }) => {
    const response = await client.get('/fr/admin/marking-techniques').redirects(0)

    response.assertStatus(302)
    response.assertHeader(
      'location',
      `/fr/login?redirect=${encodeURIComponent('/fr/admin/marking-techniques')}`
    )
  })
})

test.group('Administration des techniques de marquage - CRUD', (group) => {
  useDatabase(group)

  test("creation d'une technique avec ses traductions", async ({ client, assert }) => {
    const admin = await platformAdmin()

    const response = await client
      .post('/fr/admin/marking-techniques')
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)
      .json(SCREEN_PRINT)

    // Redirection vers l'ecran d'edition
    response.assertStatus(200)
    response.assertInertiaComponent('admin/marking_techniques/edit')

    const technique = await MarkingTechnique.findByOrFail('slug', SCREEN_PRINT.slug)
    assert.equal(technique.family, 'print')

    const fr = await MarkingTechniqueTranslation.query()
      .where('markingTechniqueId', technique.id)
      .where('locale', 'fr')
      .firstOrFail()
    assert.equal(fr.name, 'Serigraphie')
    assert.isFalse(fr.isAuto)
  })

  test('le slug doit etre unique', async ({ client, assert }) => {
    const admin = await platformAdmin()
    const existing = await MarkingTechniqueFactory.merge({ slug: 'unique-technique' }).create()
    await MarkingTechniqueTranslationFactory.merge({
      markingTechniqueId: existing.id,
      locale: 'fr',
    }).create()

    const response = await client
      .post('/fr/admin/marking-techniques')
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)
      .json({ ...SCREEN_PRINT, slug: 'unique-technique' })

    // Erreur de validation : redirection Inertia avec les erreurs en session.
    response.assertStatus(302)
    assert.lengthOf(await MarkingTechnique.query().where('slug', 'unique-technique'), 1)
  })

  test("mise a jour d'une technique", async ({ client, assert }) => {
    const admin = await platformAdmin()
    const technique = await MarkingTechniqueFactory.merge({ family: 'print' }).create()
    await MarkingTechniqueTranslationFactory.merge({
      markingTechniqueId: technique.id,
      locale: 'fr',
      name: 'Original',
    }).create()

    const response = await client
      .patch(`/fr/admin/marking-techniques/${technique.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)
      .json({
        family: 'engraving',
        translations: { fr: { name: 'Mis a jour' } },
      })

    response.assertStatus(200)
    await technique.refresh()
    assert.equal(technique.family, 'engraving')

    const fr = await MarkingTechniqueTranslation.query()
      .where('markingTechniqueId', technique.id)
      .where('locale', 'fr')
      .firstOrFail()
    assert.equal(fr.name, 'Mis a jour')
  })

  test("suppression d'une technique non utilisee", async ({ client, assert }) => {
    const admin = await platformAdmin()
    const technique = await MarkingTechniqueFactory.create()
    await MarkingTechniqueTranslationFactory.merge({
      markingTechniqueId: technique.id,
      locale: 'fr',
    }).create()

    const response = await client
      .delete(`/fr/admin/marking-techniques/${technique.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(200)
    assert.isNull(await MarkingTechnique.find(technique.id))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// No-op : une mise a jour identique ne genere ni audit ni file de traduction
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

test.group('Administration des techniques de marquage - no-op', (group) => {
  useDatabase(group)

  test('mise a jour sans changement ne cree pas de log audit ni de file de traduction', async ({
    client,
    assert,
  }) => {
    const admin = await platformAdmin()
    const technique = await MarkingTechniqueFactory.merge({
      family: 'print',
      sourceLocale: 'fr',
    }).create()
    await MarkingTechniqueTranslationFactory.merge({
      markingTechniqueId: technique.id,
      locale: 'fr',
      name: 'Serigraphie Test',
    }).create()

    const auditCountBefore = await AdminAuditLog.query()
      .where('targetType', 'marking_technique')
      .where('targetId', technique.id)
      .where('action', 'marking_technique.updated')
      .count('* as total')
      .first()
    const countBefore = Number(auditCountBefore?.$extras.total ?? 0)

    const { spy, queueCalls } = createTranslationQueueSpy()
    app.container.swap(TranslationQueueService, () => spy)

    try {
      // Reenvoyer les memes valeurs
      const response = await client
        .patch(`/fr/admin/marking-techniques/${technique.id}`)
        .withInertia()
        .withCsrfToken()
        .loginAs(admin)
        .json({
          family: 'print',
          sourceLocale: 'fr',
          translations: { fr: { name: 'Serigraphie Test' } },
        })

      response.assertStatus(200)

      // Pas de nouveau log audit
      const auditCountAfter = await AdminAuditLog.query()
        .where('targetType', 'marking_technique')
        .where('targetId', technique.id)
        .where('action', 'marking_technique.updated')
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
