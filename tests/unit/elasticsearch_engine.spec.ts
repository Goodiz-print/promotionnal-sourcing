import { test } from '@japa/runner'
import { errors } from '@elastic/elasticsearch'
import type { Client } from '@elastic/elasticsearch'
import searchConfig from '#config/search'
import ElasticsearchEngine, {
  buildIndexDefinition,
  buildProductFilters,
  buildSearchBody,
} from '#services/search/elasticsearch_engine'
import { SearchTaskFailedException } from '#exceptions/search_errors'
import type { ProductSearchDocument, ProductSearchRequest } from '#shared/types/search'

/**
 * Pilote Elasticsearch (ADR 0004), sans serveur : le client est remplacé par un
 * double qui enregistre les appels et répond comme le ferait le cluster.
 */
interface Recorded {
  call: string
  args: any
}

interface FakeOptions {
  /** Index concrets déjà rattachés à l'alias. */
  aliased?: string[]
  /** Chaque lot d'écriture renvoie cette erreur sur son premier élément. */
  bulkError?: { status: number; reason: string }
  /** L'endpoint d'inférence existe déjà. */
  inferenceExists?: boolean
}

function notFound() {
  return new errors.ResponseError({
    statusCode: 404,
    body: {},
    headers: {},
    warnings: null,
    meta: {} as never,
  })
}

class TestableEngine extends ElasticsearchEngine {
  calls: Recorded[] = []
  searchResponse: any = { hits: { total: { value: 0 }, hits: [] } }
  /** Nombre de lots acceptés avant que le réseau ne lâche. */
  failBulkAfter = Number.POSITIVE_INFINITY
  #bulks = 0
  #aliased: string[]
  #fake: Client

  constructor(private options: FakeOptions = {}) {
    super()
    this.#aliased = options.aliased ?? []
    const record = (call: string, args: unknown) => this.calls.push({ call, args })
    const fake = {
      indices: {
        getAlias: async (args: unknown) => {
          record('getAlias', args)
          if (this.#aliased.length === 0) throw notFound()
          return Object.fromEntries(this.#aliased.map((index) => [index, {}]))
        },
        create: async (args: unknown) => record('create', args),
        putAlias: async (args: { index: string }) => {
          record('putAlias', args)
          this.#aliased = [args.index]
        },
        refresh: async (args: unknown) => record('refresh', args),
        updateAliases: async (args: unknown) => record('updateAliases', args),
        delete: async (args: unknown) => record('delete', args),
      },
      bulk: async (args: unknown) => {
        record('bulk', args)
        this.#bulks += 1
        if (this.#bulks > this.failBulkAfter) throw new Error('réseau')
        const error = this.options.bulkError
        return {
          errors: Boolean(error),
          items: [
            { index: error ? { status: error.status, error: { reason: error.reason } } : {} },
          ],
        }
      },
      search: async (args: unknown) => {
        record('search', args)
        return this.searchResponse
      },
      transport: {
        request: async (args: { method: string }) => {
          record(`inference ${args.method}`, args)
          if (args.method === 'GET' && !this.options.inferenceExists) throw notFound()
          return {}
        },
      },
    }
    this.#fake = fake as unknown as Client
  }

  protected get client(): Client {
    return this.#fake
  }

  named(call: string) {
    return this.calls.filter((entry) => entry.call === call)
  }
}

function document(id: number): ProductSearchDocument {
  return {
    id,
    slug: `produit-${id}`,
    reference: null,
    categoryId: 1,
    supplierId: 1,
    madeInEurope: true,
    originCountry: 'FR',
    originZone: 'france',
    releasedAt: null,
    isEco: false,
    attributeValueIds: [3],
    attributes: { color: [3] },
    names: { fr: 'Stylo' },
    descriptions: {},
    embeddingText: 'Stylo\ncouleur : noir',
  }
}

function request(overrides: Partial<ProductSearchRequest> = {}): ProductSearchRequest {
  return { query: 'stylo', semanticRatio: 0.5, filter: {}, page: 1, perPage: 12, ...overrides }
}

async function* batches(...sizes: number[]) {
  let next = 1
  for (const size of sizes) {
    yield Array.from({ length: size }, () => document(next++))
  }
}

test.group('Elasticsearch — requêtes', () => {
  test('chaque valeur de facette est une clause de filtre : le ET exact', ({ assert }) => {
    const clauses = buildProductFilters({
      categoryId: 4,
      madeInEurope: true,
      isEco: true,
      attributeValueIds: [3, 7],
    })

    assert.deepEqual(clauses, [
      { term: { categoryId: 4 } },
      { term: { madeInEurope: true } },
      { term: { isEco: true } },
      { term: { attributeValueIds: 3 } },
      { term: { attributeValueIds: 7 } },
    ])
  })

  test('provenance en OU, nouveautés en intervalle, zones inconnues écartées', ({ assert }) => {
    const clauses = buildProductFilters({
      originZones: ['france', 'europe', 'nimporte' as never],
      releasedAfter: 1_700_000_000.9,
    })

    assert.deepEqual(clauses, [
      { terms: { originZone: ['france', 'europe'] } },
      { range: { releasedAt: { gte: 1_700_000_000 } } },
    ])
  })

  test('mots-clés seuls : texte tolérant aux fautes + filtres, pas de retriever', ({ assert }) => {
    const body = buildSearchBody(request({ semanticRatio: 0, filter: { isEco: true } }), true)

    assert.notProperty(body, 'retriever')
    assert.equal(body.from, 0)
    assert.equal(body.size, 12)
    assert.deepEqual((body.query as any).bool.filter, [{ term: { isEco: true } }])
    assert.equal((body.query as any).bool.must[0].multi_match.fuzziness, 'AUTO')
  })

  test('hybride : retriever linear pondéré par le ratio, filtres sur les deux branches', ({
    assert,
  }) => {
    const body = buildSearchBody(
      request({ semanticRatio: 0.3, page: 3, filter: { categoryId: 2 } }),
      true
    ) as any

    const linear = body.retriever.linear
    assert.equal(body.from, 24)
    assert.deepEqual(
      linear.retrievers.map((entry: any) => entry.weight),
      [0.7, 0.3]
    )
    assert.deepEqual(linear.filter, [{ term: { categoryId: 2 } }])
    assert.equal(linear.retrievers[1].retriever.standard.query.semantic.field, 'embedding')
    assert.isAtLeast(linear.rank_window_size, 24 + 12)
  })

  test('sans embedder ou sans mots-clés, jamais de requête sémantique', ({ assert }) => {
    assert.notProperty(buildSearchBody(request(), false), 'retriever')
    const blank = buildSearchBody(request({ query: '  ' }), true)
    assert.notProperty(blank, 'retriever')
    assert.deepEqual((blank.query as any).bool.must, [{ match_all: {} }])
  })

  test('le mapping vectorise embeddingText seulement avec l’embedder', ({ assert }) => {
    const withEmbedder = buildIndexDefinition(true, 'emb') as any
    const without = buildIndexDefinition(false, 'emb') as any

    assert.deepEqual(withEmbedder.mappings.properties.embedding, {
      type: 'semantic_text',
      inference_id: 'emb',
    })
    assert.equal(withEmbedder.mappings.properties.embeddingText.copy_to, 'embedding')
    assert.notProperty(without.mappings.properties, 'embedding')
    assert.equal(withEmbedder.mappings.properties.names.properties.fr.analyzer, 'french')
    // Facettes aplaties : créées à la volée, aucune liste de slugs à connaître.
    assert.isTrue(
      withEmbedder.mappings.dynamic_templates.some(
        (entry: any) => entry.facets?.path_match === 'attributes.*'
      )
    )
  })
})

test.group('Elasticsearch — pilote', (group) => {
  const previous = {
    url: searchConfig.elasticsearch.url,
    embedder: searchConfig.embedder.enabled,
  }

  group.each.setup(() => {
    searchConfig.elasticsearch.url = 'http://es.test'
    searchConfig.embedder.enabled = false
    return () => {
      searchConfig.elasticsearch.url = previous.url
      searchConfig.embedder.enabled = previous.embedder
    }
  })

  test('crée l’index et son alias au premier envoi, une seule fois', async ({ assert }) => {
    const engine = new TestableEngine()
    await engine.upsert([document(1)])
    await engine.upsert([document(2)])

    assert.lengthOf(engine.named('create'), 1)
    assert.lengthOf(engine.named('putAlias'), 1)
    assert.equal(engine.named('putAlias')[0].args.name, searchConfig.index)
    assert.lengthOf(engine.named('bulk'), 2)
    assert.deepEqual(engine.named('bulk')[0].args.operations[0], {
      index: { _index: searchConfig.index, _id: '1' },
    })
  })

  test('un alias existant n’est pas recréé', async ({ assert }) => {
    const engine = new TestableEngine({ aliased: ['products_old'] })
    await engine.upsert([document(1)])

    assert.lengthOf(engine.named('create'), 0)
  })

  test('un lot en erreur lève, pour que le job soit rejoué', async ({ assert }) => {
    const engine = new TestableEngine({
      aliased: ['x'],
      bulkError: { status: 400, reason: 'mapping invalide' },
    })

    await assert.rejects(() => engine.upsert([document(1)]), SearchTaskFailedException as never)
  })

  test('supprimer un produit déjà absent n’est pas une erreur', async ({ assert }) => {
    const engine = new TestableEngine({
      aliased: ['x'],
      bulkError: { status: 404, reason: 'not found' },
    })

    await engine.remove([5, 6])
    assert.deepEqual(engine.named('bulk')[0].args.operations, [
      { delete: { _index: searchConfig.index, _id: '5' } },
      { delete: { _index: searchConfig.index, _id: '6' } },
    ])
  })

  test('crée l’endpoint d’inférence Mistral s’il manque, avec l’embedder actif', async ({
    assert,
  }) => {
    searchConfig.embedder.enabled = true
    const engine = new TestableEngine()
    await engine.upsert([document(1)])

    const put = engine.named('inference PUT')[0].args
    assert.equal(put.path, `/_inference/text_embedding/${searchConfig.elasticsearch.inferenceId}`)
    assert.equal(put.body.service, 'mistral')

    const already = new TestableEngine({ inferenceExists: true })
    await already.upsert([document(1)])
    assert.lengthOf(already.named('inference PUT'), 0)
  })

  test('sans embedder, aucun appel d’inférence', async ({ assert }) => {
    const engine = new TestableEngine()
    await engine.upsert([document(1)])

    assert.lengthOf(engine.named('inference GET'), 0)
  })

  test('la recherche renvoie les identifiants ordonnés et le total', async ({ assert }) => {
    const engine = new TestableEngine()
    engine.searchResponse = {
      hits: { total: { value: 42 }, hits: [{ _id: '7' }, { _id: '3' }] },
    }

    const hits = await engine.search(request({ semanticRatio: 0 }))

    assert.deepEqual(hits, { ids: [7, 3], total: 42 })
    assert.equal(engine.named('search')[0].args.index, searchConfig.index)
    // Une recherche ne crée jamais l’index.
    assert.lengthOf(engine.named('create'), 0)
  })

  test('les distributions de facettes viennent des agrégations, sans produits', async ({
    assert,
  }) => {
    const engine = new TestableEngine()
    engine.searchResponse = {
      hits: { total: { value: 2 }, hits: [] },
      aggregations: {
        'attributes.color': {
          buckets: [
            { key: 3, doc_count: 2 },
            { key: 7, doc_count: 1 },
          ],
        },
      },
    }

    const distribution = await engine.facetDistribution({
      query: '',
      filter: { categoryId: 1 },
      facets: ['attributes.color', 'attributes.material'],
    })

    assert.deepEqual(distribution, {
      'attributes.color': { '3': 2, '7': 1 },
      'attributes.material': {},
    })
    assert.equal(engine.named('search')[0].args.size, 0)
    assert.deepEqual(await engine.facetDistribution({ query: '', filter: {}, facets: [] }), {})
  })

  test('reconstruction : nouvel index, bascule atomique de l’alias, ancien index supprimé', async ({
    assert,
  }) => {
    const engine = new TestableEngine({ aliased: ['products_old'] })

    const count = await engine.replaceAll(batches(2, 1))

    assert.equal(count, 3)
    const staging = engine.named('create')[0].args.index as string
    assert.match(staging, new RegExp(`^${searchConfig.index}_\\d+$`))
    assert.deepEqual(engine.named('updateAliases')[0].args.actions, [
      { remove: { index: 'products_old', alias: searchConfig.index } },
      { add: { index: staging, alias: searchConfig.index } },
    ])
    assert.deepEqual(engine.named('delete')[0].args.index, ['products_old'])
  })

  test('reconstruction interrompue : l’alias reste sur l’ancien index', async ({ assert }) => {
    const engine = new TestableEngine({ aliased: ['products_old'] })
    engine.failBulkAfter = 1

    await assert.rejects(() => engine.replaceAll(batches(2, 2)), 'réseau')

    assert.lengthOf(engine.named('updateAliases'), 0)
    const staging = engine.named('create')[0].args.index
    assert.equal(engine.named('delete')[0].args.index, staging)
  })
})
