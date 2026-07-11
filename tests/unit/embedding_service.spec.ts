import { test } from '@japa/runner'
import EmbeddingService, { type EmbeddingClient } from '#services/embedding_service'
import { toPgVector } from '#shared/helpers/pgvector'
import type Product from '#models/product'

interface CreateRequest {
  model: string
  inputs: string[]
  outputDimension?: number
}

/**
 * Faux client Mistral : enregistre la requête et renvoie un vecteur fixe.
 * Aucun appel réseau.
 */
function fakeClient(
  vector: number[],
  onCreate?: (request: CreateRequest) => void
): EmbeddingClient {
  return {
    embeddings: {
      async create(request) {
        onCreate?.(request)
        return { data: [{ embedding: vector }] }
      },
    },
  }
}

test.group('EmbeddingService (Mistral mocké)', () => {
  test('embed renvoie le vecteur et appelle Mistral avec le bon modèle', async ({ assert }) => {
    let received: CreateRequest | null = null
    const service = new EmbeddingService(fakeClient([0.1, 0.2, 0.3], (r) => (received = r)))

    const vector = await service.embed('  crayon bleu  ')

    assert.deepEqual(vector, [0.1, 0.2, 0.3])
    assert.isNotNull(received)
    assert.equal(received!.model, 'mistral-embed')
    assert.deepEqual(received!.inputs, ['crayon bleu'])
  })

  test('embed renvoie null pour un texte vide (aucun appel)', async ({ assert }) => {
    let called = false
    const service = new EmbeddingService(fakeClient([1], () => (called = true)))

    const vector = await service.embed('   ')

    assert.isNull(vector)
    assert.isFalse(called)
  })

  test('productText concatène nom + description de chaque traduction', ({ assert }) => {
    const product = {
      translations: [
        { name: 'Crayon', description: 'HB' },
        { name: 'Pencil', description: null },
      ],
    } as unknown as Product

    assert.equal(EmbeddingService.productText(product), 'Crayon HB\nPencil')
  })

  test('toPgVector sérialise en littéral pgvector', ({ assert }) => {
    assert.equal(toPgVector([1, 0.5, -2]), '[1,0.5,-2]')
  })
})
