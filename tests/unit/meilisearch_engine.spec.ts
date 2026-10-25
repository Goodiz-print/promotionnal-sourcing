import { test } from '@japa/runner'
import searchConfig from '#config/search'
import MeilisearchEngine, {
  PRODUCT_INDEX_SETTINGS,
  buildProductFilter,
} from '#services/search/meilisearch_engine'
import { SearchTaskFailedException } from '#exceptions/search_errors'
import { SEARCH_EMBEDDER, type ProductSearchDocument } from '#shared/types/search'

/**
 * Pilote Meilisearch (#112), sans serveur : `fetch` est remplacé par un double
 * qui enregistre les requêtes et répond comme le ferait Meilisearch (index
 * absent → 404 `index_not_found`, écritures → tâche, tâche → `succeeded`).
 */
interface Recorded {
  method: string
  path: string
  body: unknown
}

function stubMeilisearch(options: { existing?: string[]; failTasks?: boolean } = {}) {
  const calls: Recorded[] = []
  const indexes = new Set(options.existing ?? [])
  let taskUid = 0

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })

  const original = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string' ? input : ((input as Request).url ?? String(input))
    )
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.pathname
    const raw = init?.body
    calls.push({ method, path, body: typeof raw === 'string' ? JSON.parse(raw) : raw })

    const task = path.match(/^\/tasks\/(\d+)$/)
    if (method === 'GET' && task) {
      return json(200, {
        uid: Number(task[1]),
        status: options.failTasks ? 'failed' : 'succeeded',
        error: options.failTasks ? { message: 'boom' } : null,
        type: 'documentAdditionOrUpdate',
      })
    }

    if (method === 'POST' && path.endsWith('/search')) {
      return json(200, {
        hits: [{ id: 7 }, { id: 3 }],
        page: 1,
        hitsPerPage: 12,
        totalHits: 2,
        totalPages: 1,
        processingTimeMs: 1,
        query: 'x',
      })
    }

    const index = path.match(/^\/indexes\/([^/]+)$/)
    if (method === 'GET' && index) {
      return indexes.has(index[1])
        ? json(200, { uid: index[1], primaryKey: 'id' })
        : json(404, { message: 'not found', code: 'index_not_found', type: 'invalid_request' })
    }

    if (method === 'POST' && path === '/indexes') {
      indexes.add((calls[calls.length - 1].body as { uid: string }).uid)
    }
    if (method === 'DELETE' && index) indexes.delete(index[1])

    taskUid += 1
    return json(202, {
      taskUid,
      indexUid: 'x',
      status: 'enqueued',
      type: 'x',
      enqueuedAt: new Date().toISOString(),
    })
  }) as typeof fetch

  return { calls, restore: () => (globalThis.fetch = original) }
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
    attributeValueIds: [3],
    names: { fr: 'Stylo' },
    descriptions: {},
    _vectors: { [SEARCH_EMBEDDER]: null },
  }
}

test.group('Meilisearch — pilote', (group) => {
  const previous = { host: searchConfig.host, key: searchConfig.apiKey }

  group.each.setup(() => {
    searchConfig.host = 'http://meili.test'
    searchConfig.apiKey = 'key'
    return () => {
      searchConfig.host = previous.host
      searchConfig.apiKey = previous.key
    }
  })

  test('crée l’index avec ses réglages au premier envoi, une seule fois', async ({ assert }) => {
    const stub = stubMeilisearch()
    try {
      const engine = new MeilisearchEngine()
      await engine.upsert([document(1)])
      await engine.upsert([document(2)])

      const created = stub.calls.filter(
        (call) => call.method === 'POST' && call.path === '/indexes'
      )
      assert.lengthOf(created, 1)
      assert.deepInclude(created[0].body as object, {
        uid: searchConfig.index,
        primaryKey: 'id',
      })
      const settings = stub.calls.filter((call) => call.path.endsWith('/settings'))
      assert.lengthOf(settings, 1)
      assert.deepEqual(settings[0].body, PRODUCT_INDEX_SETTINGS)
      const embedder = (settings[0].body as { embedders: Record<string, { source: string }> })
        .embedders[SEARCH_EMBEDDER]
      assert.equal(embedder.source, 'userProvided')

      const writes = stub.calls.filter((call) => call.path.endsWith('/documents'))
      assert.lengthOf(writes, 2)
    } finally {
      stub.restore()
    }
  })

  test('n’envoie rien quand il n’y a rien à écrire ni à retirer', async ({ assert }) => {
    const stub = stubMeilisearch()
    try {
      const engine = new MeilisearchEngine()
      await engine.upsert([])
      await engine.remove([])

      assert.lengthOf(stub.calls, 0)
    } finally {
      stub.restore()
    }
  })

  test('une tâche en échec lève une erreur (le job sera rejoué)', async ({ assert }) => {
    const stub = stubMeilisearch({ existing: [searchConfig.index], failTasks: true })
    try {
      await assert.rejects(
        () => new MeilisearchEngine().upsert([document(1)]),
        SearchTaskFailedException
      )
    } finally {
      stub.restore()
    }
  })

  test('la reconstruction écrit dans un index temporaire puis l’échange', async ({ assert }) => {
    const stub = stubMeilisearch({ existing: [searchConfig.index] })
    try {
      async function* batches() {
        yield [document(1), document(2)]
        yield [document(3)]
      }

      const count = await new MeilisearchEngine().replaceAll(batches())

      assert.equal(count, 3)
      const staging = `${searchConfig.index}_next`
      const order = stub.calls
        .filter((call) => call.method !== 'GET')
        .map((call) => `${call.method} ${call.path}`)
      const swapAt = order.indexOf('POST /swap-indexes')
      assert.isAbove(swapAt, -1)
      // Les documents partent dans l'index temporaire, avant l'échange.
      const stagingWrites = order.filter((entry) => entry === `POST /indexes/${staging}/documents`)
      assert.lengthOf(stagingWrites, 2)
      assert.isTrue(order.lastIndexOf(`POST /indexes/${staging}/documents`) < swapAt)
      assert.deepEqual(stub.calls.find((call) => call.path === '/swap-indexes')!.body, [
        { indexes: [searchConfig.index, staging], rename: false },
      ])
      // L'index temporaire est supprimé à la fin, succès ou non.
      assert.equal(order[order.length - 1], `DELETE /indexes/${staging}`)
    } finally {
      stub.restore()
    }
  })

  test('un échec en cours de reconstruction laisse l’index actif intact', async ({ assert }) => {
    const stub = stubMeilisearch({ existing: [searchConfig.index] })
    try {
      async function* broken() {
        yield [document(1)]
        throw new Error('base indisponible')
      }

      await assert.rejects(() => new MeilisearchEngine().replaceAll(broken()), 'base indisponible')

      assert.isUndefined(stub.calls.find((call) => call.path === '/swap-indexes'))
      assert.isDefined(
        stub.calls.find(
          (call) => call.method === 'DELETE' && call.path === `/indexes/${searchConfig.index}_next`
        )
      )
    } finally {
      stub.restore()
    }
  })
})

test.group('Meilisearch — recherche', (group) => {
  const previous = { host: searchConfig.host, key: searchConfig.apiKey }

  group.each.setup(() => {
    searchConfig.host = 'http://meili.test'
    searchConfig.apiKey = 'key'
    return () => {
      searchConfig.host = previous.host
      searchConfig.apiKey = previous.key
    }
  })

  test('le filtre combine les critères en ET, une clause par valeur de facette', ({ assert }) => {
    assert.isUndefined(buildProductFilter({}))
    assert.isUndefined(buildProductFilter({ categoryId: null, attributeValueIds: [] }))
    assert.equal(
      buildProductFilter({ categoryId: 4, madeInEurope: true, attributeValueIds: [3, 7] }),
      'categoryId = 4 AND madeInEurope = true AND attributeValueIds = 3 AND attributeValueIds = 7'
    )
  })

  test('le vecteur et le ratio partent dans une requête hybride, avec les filtres', async ({
    assert,
  }) => {
    const stub = stubMeilisearch()
    try {
      const vector = [0.1, 0.2]
      const hits = await new MeilisearchEngine().search({
        query: 'crayon bleu',
        vector,
        semanticRatio: 0.4,
        filter: { categoryId: 2, attributeValueIds: [5] },
        page: 2,
        perPage: 12,
      })

      assert.deepEqual(hits, { ids: [7, 3], total: 2 })
      const call = stub.calls.find((entry) => entry.path.endsWith('/search'))!
      assert.equal(call.path, `/indexes/${searchConfig.index}/search`)
      assert.deepInclude(call.body as object, {
        q: 'crayon bleu',
        filter: 'categoryId = 2 AND attributeValueIds = 5',
        page: 2,
        hitsPerPage: 12,
        vector,
        hybrid: { embedder: SEARCH_EMBEDDER, semanticRatio: 0.4 },
      })
      // Une recherche ne crée ni index ni réglages.
      assert.isUndefined(stub.calls.find((entry) => entry.path.endsWith('/settings')))
    } finally {
      stub.restore()
    }
  })

  test('sans vecteur, la requête est par mots-clés seuls', async ({ assert }) => {
    const stub = stubMeilisearch()
    try {
      await new MeilisearchEngine().search({
        query: 'crayon',
        vector: null,
        semanticRatio: 0.5,
        filter: {},
        page: 1,
        perPage: 12,
      })

      const body = stub.calls.find((entry) => entry.path.endsWith('/search'))!.body as object
      assert.notProperty(body, 'hybrid')
      assert.notProperty(body, 'vector')
      assert.notProperty(body, 'filter')
    } finally {
      stub.restore()
    }
  })
})
