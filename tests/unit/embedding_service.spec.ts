import { test } from '@japa/runner'
import EmbeddingService from '#services/embedding_service'
import MistralEmbeddingProvider, {
  type MistralClientLike,
} from '#services/embeddings/mistral_provider'
import OpenAiCompatibleEmbeddingProvider from '#services/embeddings/openai_compatible_provider'
import { embeddingProviderFor } from '#services/embeddings/provider_registry'
import { toPgVector } from '#shared/helpers/pgvector'
import aiConfig from '#config/ai'
import type EmbeddingProvider from '#services/embeddings/embedding_provider'
import type { FetchLike } from '#shared/types/ai'
import type Product from '#models/product'

const DIMS = aiConfig.embeddings.dimensions

function vector(length = DIMS): number[] {
  return new Array<number>(length).fill(0.1)
}

/** Provider factice : renvoie un vecteur fixe et compte les appels. */
function fakeProvider(out: number[], onEmbed?: (text: string) => void): EmbeddingProvider {
  return {
    name: 'mistral',
    model: 'test-embed',
    async embed(text) {
      onEmbed?.(text)
      return out
    },
  }
}

test.group('EmbeddingService (provider injecté)', () => {
  test('embed délègue au provider et valide la dimension', async ({ assert }) => {
    let received: string | null = null
    const service = new EmbeddingService(fakeProvider(vector(), (t) => (received = t)))

    const result = await service.embed('  crayon bleu  ')

    assert.lengthOf(result!, DIMS)
    assert.equal(received, 'crayon bleu')
  })

  test('embed renvoie null pour un texte vide (provider non appelé)', async ({ assert }) => {
    let called = false
    const service = new EmbeddingService(fakeProvider(vector(), () => (called = true)))

    assert.isNull(await service.embed('   '))
    assert.isFalse(called)
  })

  test('embed rejette une dimension incompatible', async ({ assert }) => {
    const service = new EmbeddingService(fakeProvider(vector(8)))
    await assert.rejects(() => service.embed('x'), /dimension mismatch/)
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

test.group('Drivers d’embeddings', () => {
  test('Mistral : appelle le SDK avec le modèle + la dimension demandée', async ({ assert }) => {
    let request: { model: string; inputs: string[]; outputDimension?: number } | null = null
    const client: MistralClientLike = {
      embeddings: {
        async create(req) {
          request = req
          return { data: [{ embedding: [0.1, 0.2, 0.3] }] }
        },
      },
    }

    const provider = new MistralEmbeddingProvider(client)
    const result = await provider.embed('bonjour')

    assert.deepEqual(result, [0.1, 0.2, 0.3])
    assert.equal(request!.model, aiConfig.mistral.model)
    assert.deepEqual(request!.inputs, ['bonjour'])
    assert.equal(request!.outputDimension, DIMS)
  })

  test('OpenAI-compatible : POST {baseUrl}/embeddings avec la dimension', async ({ assert }) => {
    let call: { url: string; body: string } | null = null
    const fakeFetch: FetchLike = async (url, init) => {
      call = { url, body: init.body }
      return {
        ok: true,
        status: 200,
        async json() {
          return { data: [{ embedding: [0.4, 0.5] }] }
        },
        async text() {
          return ''
        },
      }
    }

    const provider = new OpenAiCompatibleEmbeddingProvider(fakeFetch)
    const result = await provider.embed('hello')

    assert.deepEqual(result, [0.4, 0.5])
    assert.match(call!.url, /\/embeddings$/)
    const body = JSON.parse(call!.body) as { input: string; dimensions: number }
    assert.equal(body.input, 'hello')
    assert.equal(body.dimensions, DIMS)
  })

  test('OpenAI-compatible : lève sur réponse HTTP non OK', async ({ assert }) => {
    const fakeFetch: FetchLike = async () => ({
      ok: false,
      status: 500,
      async json() {
        return {}
      },
      async text() {
        return 'boom'
      },
    })

    const provider = new OpenAiCompatibleEmbeddingProvider(fakeFetch)
    await assert.rejects(() => provider.embed('hello'), /HTTP 500/)
  })
})

test.group('embeddingProviderFor', () => {
  test('renvoie la classe du driver pour les providers supportés', ({ assert }) => {
    assert.equal(embeddingProviderFor('mistral'), MistralEmbeddingProvider)
    assert.equal(embeddingProviderFor('openai-compatible'), OpenAiCompatibleEmbeddingProvider)
  })

  test('lève pour un provider inconnu', ({ assert }) => {
    assert.throws(() => embeddingProviderFor('nope'), /Unknown AI provider/)
  })
})
