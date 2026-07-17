import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import queue from '@adonisjs/queue/services/main'
import type { Mistral } from '@mistralai/mistralai'
import { isPostgres } from '#tests/utils/database'
import MainSeeder from '#database/seeders/main_seeder'
import Product from '#models/product'
import ProductEmbeddingService from '#services/product_embedding_service'
import GenerateProductEmbeddingJob from '#jobs/generate_product_embedding_job'

function fakeEmbeddingService(vector: number[]): ProductEmbeddingService {
  const client: Pick<Mistral, 'embeddings'> = {
    embeddings: {
      create: async () => ({
        id: 'fake',
        object: 'list',
        model: 'mistral-embed',
        usage: {} as never,
        data: [{ embedding: vector }],
      }),
    } as unknown as Mistral['embeddings'],
  }
  return new ProductEmbeddingService(client)
}

function fakeJobContext() {
  return {
    jobId: 'fake-job-id',
    name: 'GenerateProductEmbeddingJob',
    attempt: 1,
    queue: 'default',
    priority: 0,
    acquiredAt: new Date(),
    stalledCount: 0,
  }
}

test.group('GenerateProductEmbeddingJob', (group) => {
  if (isPostgres()) {
    group.setup(() => testUtils.db().truncate())
    group.setup(() => new MainSeeder(db.connection()).run())
  } else {
    group.tap((t) => t.skip(true, 'pgvector : PostgreSQL requis'))
  }

  test('execute() peuple products.embedding via le service injecté (zéro appel réseau)', async ({
    assert,
  }) => {
    const product = await Product.query().firstOrFail()
    const vector = Array.from({ length: 1024 }, (_, i) => i / 1024)

    const job = new GenerateProductEmbeddingJob(fakeEmbeddingService(vector))
    job.$hydrate({ productId: product.id }, fakeJobContext())

    await job.execute()

    const result = await db.rawQuery(
      'SELECT embedding IS NOT NULL AS has_embedding FROM products WHERE id = ?',
      [product.id]
    )
    assert.isTrue(result.rows[0].has_embedding)
  })

  test('execute() ne plante pas si le produit est introuvable', async ({ assert }) => {
    const job = new GenerateProductEmbeddingJob(fakeEmbeddingService([1, 2, 3]))
    job.$hydrate({ productId: 999_999 }, fakeJobContext())

    await assert.doesNotReject(() => job.execute())
  })

  test("la sauvegarde d'une traduction produit met en file GenerateProductEmbeddingJob", async ({
    assert,
  }) => {
    using fake = queue.fake()
    const product = await Product.query().preload('translations').firstOrFail()
    const translation = product.translations.find((t) => t.locale === 'fr')!

    translation.name = 'Nom mis à jour'
    await translation.save()

    assert.doesNotThrow(() =>
      fake.assertPushed(GenerateProductEmbeddingJob.name, {
        payload: { productId: product.id },
      })
    )
  })
})
