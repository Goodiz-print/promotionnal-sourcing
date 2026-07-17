import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import type { Mistral } from '@mistralai/mistralai'
import { isPostgres } from '#tests/utils/database'
import MainSeeder from '#database/seeders/main_seeder'
import Product from '#models/product'
import ProductEmbeddingService from '#services/product_embedding_service'
import ProductCatalogueService from '#services/product_catalogue_service'

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

async function setEmbedding(productId: number, vector: number[]) {
  await db.rawQuery('UPDATE products SET embedding = ?::vector WHERE id = ?', [
    `[${vector.join(',')}]`,
    productId,
  ])
}

test.group('ProductCatalogueService — recherche hybride', (group) => {
  if (isPostgres()) {
    group.setup(() => testUtils.db().truncate())
    group.setup(() => new MainSeeder(db.connection()).run())
  } else {
    group.tap((t) => t.skip(true, 'pgvector/tsvector : PostgreSQL requis'))
  }

  test('recherche lexicale : "crayon" remonte les crayons via le full-text', async ({ assert }) => {
    const service = new ProductCatalogueService(fakeEmbeddingService(Array(1024).fill(0)))

    const results = await service.search('crayon', 'fr', 10)

    assert.isAbove(results.length, 0)
  })

  test("recherche purement sémantique : produit sans match lexical remonté via l'embedding", async ({
    assert,
  }) => {
    const target = await Product.query().orderBy('id').firstOrFail()
    const otherVector = Array(1024).fill(0.9)
    const targetVector = Array(1024).fill(0.1)

    // Un embedding proche de la requête sur le produit cible, un embedding
    // éloigné sur un autre produit — seule la similarité vectorielle doit
    // ordonner le résultat, aucun des deux ne matche le texte de la requête.
    const other = await Product.query().orderBy('id').offset(1).firstOrFail()
    await setEmbedding(target.id, targetVector)
    await setEmbedding(other.id, otherVector)

    const service = new ProductCatalogueService(fakeEmbeddingService(targetVector))
    const results = await service.search('zzz_terme_absent_du_catalogue', 'fr', 5)

    assert.isAbove(results.length, 0)
    assert.equal(results[0].productId, target.id)
  })
})
