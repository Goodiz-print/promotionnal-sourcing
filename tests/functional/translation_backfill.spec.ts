import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Product from '#models/product'
import Supplier from '#models/supplier'
import { UserFactory } from '#database/factories/user_factory'
import ModerationService from '#services/moderation_service'
import TranslationBackfillService from '#services/translation_backfill_service'
import type TranslationQueueService from '#services/translation_queue_service'
import { useDatabase } from '#tests/utils/setup'
import type { TranslatableEntity } from '#shared/types/ai'

interface QueuedCall {
  entity: TranslatableEntity
  entityId: number
  sourceLocale: string
}

/**
 * Faux service de file : enregistre les entités mises en file sans lancer de job.
 * `failAfter` fait refuser la file à partir du n-ième appel (file indisponible).
 */
function fakeQueue(failAfter = Infinity): { calls: QueuedCall[]; queue: TranslationQueueService } {
  const calls: QueuedCall[] = []
  const queue = {
    async queue(entity: TranslatableEntity, entityId: number, sourceLocale: string) {
      calls.push({ entity, entityId, sourceLocale })
      return calls.length <= failAfter
    },
  } as unknown as TranslationQueueService
  return { calls, queue }
}

async function count(table: string): Promise<number> {
  const [row] = await db.from(table).count('* as total')
  return Number(row.total)
}

/** Produits actifs et visibles : mêmes règles que le rattrapage. */
async function visibleProductIds(): Promise<number[]> {
  const products = await Product.query()
    .select('id')
    .where('isActive', true)
    .withScopes((scopes) => {
      scopes.fromLiveOrganization()
      scopes.notRejected()
    })
    .orderBy('id')
  return products.map((product) => product.id)
}

test.group('Rattrapage des traductions (#97)', (group) => {
  useDatabase(group, { seed: 'full' })

  test('met en file les produits visibles, catégories, attributs et valeurs', async ({
    assert,
  }) => {
    const { calls, queue } = fakeQueue()

    const report = await new TranslationBackfillService(queue).backfill()

    assert.isFalse(report.failed)
    assert.deepEqual(
      calls.filter((c) => c.entity === 'product').map((c) => c.entityId),
      await visibleProductIds()
    )
    assert.equal(report.queued.category, await count('categories'))
    assert.equal(report.queued.attribute, await count('attributes'))
    assert.equal(report.queued.attribute_value, await count('attribute_values'))
    assert.equal(report.queued.certification, await count('certifications'))
    assert.equal(report.queued.marking_technique, await count('marking_techniques'))
    assert.equal(
      calls.length,
      report.queued.product +
        report.queued.category +
        report.queued.attribute +
        report.queued.attribute_value +
        report.queued.certification +
        report.queued.marking_technique
    )
  })

  test('écarte les produits inactifs et ceux rejetés par la modération', async ({ assert }) => {
    // `limit` est ignoré par un UPDATE PostgreSQL : on cible des ids précis.
    const [first, second] = await db.from('products').orderBy('id').limit(2)
    await db.from('products').where('id', first.id).update({ is_active: false })
    const reviewer = await UserFactory.apply('platformAdmin').create()
    await new ModerationService().decide({
      targetType: 'product',
      targetId: second.id,
      status: 'rejected',
      decidedBy: reviewer,
      reason: 'Photos non conformes',
    })
    const { calls, queue } = fakeQueue()

    await new TranslationBackfillService(queue).backfill({ entities: ['product'] })

    const queued = calls.map((c) => c.entityId)
    assert.notInclude(queued, first.id)
    assert.notInclude(queued, second.id)
    assert.isAbove(queued.length, 0)
    assert.deepEqual(queued, await visibleProductIds())
  })

  test('supplierId restreint les produits à cette fiche (rattachement, #240)', async ({
    assert,
  }) => {
    const supplier = await Supplier.findByOrFail('slug', 'nordic-promo')
    const rows = await Product.query().select('id').where('supplierId', supplier.id)
    const fiche = new Set(rows.map((row) => row.id))
    const visible = await visibleProductIds()
    const ownIds = visible.filter((id) => fiche.has(id))
    const { calls, queue } = fakeQueue()

    const report = await new TranslationBackfillService(queue).backfill({
      entities: ['product'],
      supplierId: supplier.id,
    })

    const queued = calls.map((c) => c.entityId)
    assert.isAbove(queued.length, 0)
    assert.isTrue(queued.every((id) => fiche.has(id)))
    assert.deepEqual(queued, ownIds)
    assert.equal(report.queued.product, queued.length)
  })

  test('une fiche non rattachée n’est pas traduite, même ciblée (#240)', async ({ assert }) => {
    const supplier = await Supplier.findByOrFail('slug', 'nordic-promo')
    await Supplier.query().where('id', supplier.id).update({ organizationId: null })
    const { calls, queue } = fakeQueue()

    await new TranslationBackfillService(queue).backfill({
      entities: ['product'],
      supplierId: supplier.id,
    })

    assert.lengthOf(calls, 0)
  })

  test("transmet la langue source de l'entité", async ({ assert }) => {
    const category = await db.from('categories').orderBy('id').firstOrFail()
    await db.from('categories').where('id', category.id).update({ source_locale: 'bg' })
    const { calls, queue } = fakeQueue()

    await new TranslationBackfillService(queue).backfill({ entities: ['category'] })

    const call = calls.find((c) => c.entityId === category.id)
    assert.equal(call?.sourceLocale, 'bg')
  })

  test('respecte le filtre de types et la limite par type', async ({ assert }) => {
    const { calls, queue } = fakeQueue()

    const report = await new TranslationBackfillService(queue).backfill({
      entities: ['product', 'category'],
      limit: 1,
    })

    assert.isFalse(report.failed)
    assert.deepEqual(report.queued, {
      product: 1,
      category: 1,
      attribute: 0,
      attribute_value: 0,
      certification: 0,
      marking_technique: 0,
    })
    assert.deepEqual(calls.map((c) => c.entity).sort(), ['category', 'product'])
  })

  test("s'arrête au premier job refusé par la file et ne le compte pas", async ({ assert }) => {
    const { calls, queue } = fakeQueue(1)

    const report = await new TranslationBackfillService(queue).backfill({ entities: ['category'] })

    assert.isTrue(report.failed)
    assert.equal(report.queued.category, 1)
    assert.lengthOf(calls, 2)
  })
})
