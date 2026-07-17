import { test } from '@japa/runner'
import type { Mistral } from '@mistralai/mistralai'
import type * as components from '@mistralai/mistralai/models/components'
import ProductEmbeddingService from '#services/product_embedding_service'
import { EmbeddingGenerationError } from '#exceptions/embedding_errors'

test.group('ProductEmbeddingService', () => {
  test('embed() appelle Mistral (mistral-embed) et renvoie le vecteur', async ({ assert }) => {
    const calls: unknown[] = []
    const fakeClient: Pick<Mistral, 'embeddings'> = {
      embeddings: {
        create: async (request: components.EmbeddingRequest) => {
          calls.push(request)
          return {
            id: 'x',
            object: 'list',
            model: 'mistral-embed',
            usage: {} as never,
            data: [{ embedding: [0.1, 0.2, 0.3] }],
          }
        },
      } as unknown as Mistral['embeddings'],
    }

    const service = new ProductEmbeddingService(fakeClient)
    const embedding = await service.embed('stylo écologique')

    assert.deepEqual(embedding, [0.1, 0.2, 0.3])
    assert.deepEqual(calls, [{ model: 'mistral-embed', inputs: ['stylo écologique'] }])
  })

  test('embed() leve EmbeddingGenerationError si la reponse ne porte pas de vecteur', async ({
    assert,
  }) => {
    const fakeClient: Pick<Mistral, 'embeddings'> = {
      embeddings: {
        create: async () => ({
          id: 'x',
          object: 'list',
          model: 'mistral-embed',
          usage: {} as never,
          data: [],
        }),
      } as unknown as Mistral['embeddings'],
    }
    const service = new ProductEmbeddingService(fakeClient)

    await assert.rejects(() => service.embed('x'), EmbeddingGenerationError)
  })
})
