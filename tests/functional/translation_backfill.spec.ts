import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import TranslationBackfillService from '#services/translation_backfill_service'
import type TranslationQueueService from '#services/translation_queue_service'
import { useDatabase } from '#tests/utils/setup'
import type { TranslatableEntity } from '#shared/types/ai'

interface QueuedCall {
  entity: TranslatableEntity
  entityId: number
  sourceLocale: string
}

/** Faux service de file : enregistre les entités mises en file sans lancer de job. */
function fakeQueue(): { calls: QueuedCall[]; queue: TranslationQueueService } {
  const calls: QueuedCall[] = []
  const queue = {
    async queue(entity: TranslatableEntity, entityId: number, sourceLocale: string) {
      calls.push({ entity, entityId, sourceLocale })
    },
  } as unknown as TranslationQueueService
  return { calls, queue }
}

async function count(table: string, activeOnly = false): Promise<number> {
  const query = db.from(table).count('* as total')
  if (activeOnly) query.where('is_active', true)
  const [row] = await query
  return Number(row.total)
}

test.group('Rattrapage des traductions (#97)', (group) => {
  useDatabase(group, { seed: 'full' })

  test('met en file les produits actifs, catégories, attributs et valeurs', async ({ assert }) => {
    // `limit` est ignoré par un UPDATE PostgreSQL : on cible l'id du premier produit.
    const first = await db.from('products').orderBy('id').firstOrFail()
    await db.from('products').where('id', first.id).update({ is_active: false })
    const { calls, queue } = fakeQueue()

    const report = await new TranslationBackfillService(queue).backfill()

    assert.equal(report.product, (await count('products')) - 1)
    assert.equal(report.product, await count('products', true))
    assert.equal(report.category, await count('categories'))
    assert.equal(report.attribute, await count('attributes'))
    assert.equal(report.attribute_value, await count('attribute_values'))
    assert.isAbove(report.product, 0)
    assert.equal(
      calls.length,
      report.product + report.category + report.attribute + report.attribute_value
    )
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

    assert.deepEqual(report, { product: 1, category: 1, attribute: 0, attribute_value: 0 })
    assert.deepEqual(calls.map((c) => c.entity).sort(), ['category', 'product'])
  })
})
