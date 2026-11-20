import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from '@japa/runner'
import supplierFeedsConfig from '#config/supplier_feeds'
import SupplierHttpClient from '#services/supplier_feed/supplier_http_client'
import { SupplierFeedHttpException } from '#exceptions/supplier_feed_errors'
import { withSupplierCredentials } from '#tests/utils/supplier_feed'
import type { Group } from '@japa/runner/core'

const URL = 'https://feeds.fixture.example/catalogue.json'

/** Corps dont la lecture échoue en cours de route (connexion coupée). */
function brokenBody(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"items":['))
      controller.error(new Error('socket hang up'))
    },
  })
}

interface RecordedCall {
  url: string
  method: string
  headers: Record<string, string>
  body: string | undefined
}

/**
 * Remplace `fetch` par une file de réponses (une fabrique par appel, qui peut
 * lever pour simuler une panne réseau) et isole le cache dans un dossier
 * temporaire. Tout est restauré après chaque test.
 */
function stubFetch(group: Group) {
  const state: { calls: RecordedCall[]; responses: Array<() => Response> } = {
    calls: [],
    responses: [],
  }
  group.each.setup(async () => {
    const http = supplierFeedsConfig.http
    const previous = {
      directory: http.cacheDirectory,
      ttl: http.cacheTtlMs,
      fetch: globalThis.fetch,
    }
    http.cacheDirectory = await mkdtemp(join(tmpdir(), 'supplier-feeds-'))
    state.calls = []
    state.responses = []
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      state.calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: typeof init?.body === 'string' ? init.body : undefined,
      })
      const next = state.responses.shift()
      if (!next) throw new Error('unexpected fetch')
      return next()
    }) as typeof fetch
    return async () => {
      globalThis.fetch = previous.fetch
      await rm(http.cacheDirectory, { recursive: true, force: true })
      http.cacheDirectory = previous.directory
      http.cacheTtlMs = previous.ttl
    }
  })
  return state
}

/** Erreur levée par `run`, pour en inspecter le message. */
async function failureOf(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run()
  } catch (error) {
    return error as Error
  }
  throw new Error('expected a rejection')
}

const json = (value: unknown) => () => Response.json(value)
const status = (code: number) => () => new Response('', { status: code })
const networkError = () => {
  throw new TypeError('fetch failed')
}
const cached = () => readdir(supplierFeedsConfig.http.cacheDirectory)

test.group('Client HTTP des flux — requêtes', (group) => {
  const state = stubFetch(group)
  const attempts = () => supplierFeedsConfig.http.retries + 1

  test('getJson : JSON renvoyé, en-têtes du fournisseur et User-Agent envoyés', async ({
    assert,
  }) => {
    state.responses = [json({ items: [1] })]
    const body = await new SupplierHttpClient().getJson(URL, { 'X-Key': 'fixture' })

    assert.deepEqual(body, { items: [1] })
    assert.lengthOf(state.calls, 1)
    assert.equal(state.calls[0].method, 'GET')
    assert.equal(state.calls[0].headers['X-Key'], 'fixture')
    assert.equal(state.calls[0].headers['Accept'], 'application/json')
    assert.equal(state.calls[0].headers['User-Agent'], supplierFeedsConfig.http.userAgent)
  })

  test('5xx puis succès : la requête est retentée', async ({ assert }) => {
    state.responses = [status(503), json({ ok: true })]
    assert.deepEqual(await new SupplierHttpClient().getJson(URL), { ok: true })
    assert.lengthOf(state.calls, 2)
  })

  test('5xx persistant : erreur après le dernier essai, statut dans le message', async ({
    assert,
  }) => {
    state.responses = Array.from({ length: attempts() }, () => status(502))
    await assert.rejects(() => new SupplierHttpClient().getJson(URL), /HTTP 502/)
    assert.lengthOf(state.calls, attempts())
  })

  test('4xx : erreur immédiate, aucun nouvel essai', async ({ assert }) => {
    state.responses = [status(403), json({ never: 'served' })]
    await assert.rejects(() => new SupplierHttpClient().getJson(URL), /HTTP 403/)
    assert.lengthOf(state.calls, 1)
  })

  test('panne réseau : retentée, puis flux déclaré injoignable', async ({ assert }) => {
    state.responses = [networkError, json({ ok: true })]
    assert.deepEqual(await new SupplierHttpClient().getJson(URL), { ok: true })

    state.responses = Array.from({ length: attempts() }, () => networkError)
    const error = await failureOf(() => new SupplierHttpClient().getJson(URL))
    assert.instanceOf(error, SupplierFeedHttpException)
    assert.match(error.message, /Flux injoignable/)
  })

  test('réponse non JSON : erreur explicite', async ({ assert }) => {
    state.responses = [() => new Response('<html>maintenance</html>')]
    await assert.rejects(() => new SupplierHttpClient().getJson(URL), /Réponse JSON illisible/)
  })

  test('les messages d’erreur masquent la clé d’API et la query string', async ({ assert }) => {
    const restore = withSupplierCredentials({ passotApiKey: 'fixture-secret-key' })
    try {
      state.responses = [status(401)]
      const error = await failureOf(() =>
        new SupplierHttpClient().getJson(
          'https://feeds.fixture.example/fixture-secret-key/catalogue.json?token=abc'
        )
      )

      assert.instanceOf(error, SupplierFeedHttpException)
      assert.notInclude(error.message, 'fixture-secret-key')
      assert.notInclude(error.message, 'token=abc')
      assert.include(error.message, 'https://feeds.fixture.example/***/catalogue.json?***')
    } finally {
      restore()
    }
  })

  test('postJson : corps JSON envoyé en POST, réponse lue', async ({ assert }) => {
    state.responses = [json({ token: 'fixture' })]
    const body = await new SupplierHttpClient().postJson(URL, { email: 'fixture@example.com' })

    assert.deepEqual(body, { token: 'fixture' })
    assert.equal(state.calls[0].method, 'POST')
    assert.equal(state.calls[0].headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(state.calls[0].body ?? ''), { email: 'fixture@example.com' })
    // Jamais mis en cache : la réponse porte un jeton de session.
    assert.deepEqual(await cached(), [])
  })

  test('postJson : 4xx et réponse illisible lèvent une erreur', async ({ assert }) => {
    state.responses = [status(401)]
    await assert.rejects(() => new SupplierHttpClient().postJson(URL, {}), /HTTP 401/)
    state.responses = [() => new Response('not json')]
    await assert.rejects(() => new SupplierHttpClient().postJson(URL, {}), /JSON illisible/)
  })

  test('getBuffer : contenu binaire et type MIME, type générique par défaut', async ({
    assert,
  }) => {
    const png = () =>
      new Response(Buffer.from([1, 2, 3]), { headers: { 'content-type': 'image/png' } })
    const untyped = () => {
      const response = new Response(Buffer.from([4]))
      response.headers.delete('content-type')
      return response
    }
    state.responses = [png, untyped]
    const client = new SupplierHttpClient()

    const image = await client.getBuffer(URL)
    assert.deepEqual([...image.content], [1, 2, 3])
    assert.equal(image.mimeType, 'image/png')
    const untypedImage = await client.getBuffer(URL)
    assert.equal(untypedImage.mimeType, 'application/octet-stream')
  })

  test('getBuffer : image introuvable, erreur', async ({ assert }) => {
    state.responses = [status(404)]
    await assert.rejects(() => new SupplierHttpClient().getBuffer(URL), SupplierFeedHttpException)
  })
})

test.group('Client HTTP des flux — cache disque', (group) => {
  const state = stubFetch(group)

  test('une copie fraîche est réutilisée sans nouvel appel', async ({ assert }) => {
    state.responses = [json({ version: 1 })]
    const client = new SupplierHttpClient()

    assert.deepEqual(await client.getJson(URL, {}, { refresh: false }), { version: 1 })
    assert.deepEqual(await client.getJson(URL, {}, { refresh: false }), { version: 1 })
    assert.lengthOf(state.calls, 1)
    // Nom de fichier = empreinte : ni l'URL ni un secret en clair.
    const [file] = await cached()
    assert.match(file, /^[0-9a-f]{64}\.json$/)
  })

  test('--refresh et copie périmée retéléchargent', async ({ assert }) => {
    state.responses = [json({ version: 1 }), json({ version: 2 }), json({ version: 3 })]
    const client = new SupplierHttpClient()

    await client.getJson(URL, {}, { refresh: false })
    assert.deepEqual(await client.getJson(URL, {}, { refresh: true }), { version: 2 })
    // Durée de vie négative : la copie est périmée quelle que soit la précision de l'horodatage.
    supplierFeedsConfig.http.cacheTtlMs = -1
    assert.deepEqual(await client.getJson(URL, {}, { refresh: false }), { version: 3 })
    assert.lengthOf(state.calls, 3)
    assert.lengthOf(await cached(), 1)
  })

  test('cache rattaché au compte : en-têtes distincts, ou scope commun', async ({ assert }) => {
    state.responses = [json({ account: 'a' }), json({ account: 'b' }), json({ account: 'scoped' })]
    const client = new SupplierHttpClient()

    await client.getJson(URL, { 'X-Key': 'a' }, { refresh: false })
    // Autre clé d'API = autre compte = autres prix : pas de copie partagée.
    assert.deepEqual(await client.getJson(URL, { 'X-Key': 'b' }, { refresh: false }), {
      account: 'b',
    })
    // Jeton de session qui change : le scope tient lieu d'identité.
    const scope = { refresh: false, scope: 'fixture@example.com' }
    await client.getJson(URL, { Authorization: 'Bearer 1' }, scope)
    assert.deepEqual(await client.getJson(URL, { Authorization: 'Bearer 2' }, scope), {
      account: 'scoped',
    })
    assert.lengthOf(state.calls, 3)
  })

  test('téléchargement coupé : retenté, aucun fichier partiel laissé', async ({ assert }) => {
    state.responses = [() => new Response(brokenBody()), json({ version: 1 })]
    const client = new SupplierHttpClient()

    assert.deepEqual(await client.getJson(URL, {}, { refresh: false }), { version: 1 })
    assert.lengthOf(state.calls, 2)
    const files = await cached()
    assert.deepEqual(
      files.filter((file) => file.endsWith('.part')),
      []
    )
  })

  test('téléchargement toujours coupé : erreur, rien en cache', async ({ assert }) => {
    const attempts = supplierFeedsConfig.http.retries + 1
    state.responses = Array.from({ length: attempts }, () => () => new Response(brokenBody()))
    await assert.rejects(
      () => new SupplierHttpClient().getJson(URL, {}, { refresh: false }),
      SupplierFeedHttpException
    )
    assert.lengthOf(state.calls, attempts)
    assert.deepEqual(await cached(), [])
  })

  test('réponse illisible : erreur et copie supprimée', async ({ assert }) => {
    state.responses = [() => new Response('<html>maintenance</html>')]
    await assert.rejects(
      () => new SupplierHttpClient().getJson(URL, {}, { refresh: false }),
      SupplierFeedHttpException
    )
    assert.deepEqual(await cached(), [])
  })

  test('sans cache : rien n’est écrit sur disque', async ({ assert }) => {
    state.responses = [json({ version: 1 })]
    assert.deepEqual(await new SupplierHttpClient().getJson(URL), { version: 1 })
    assert.deepEqual(await cached(), [])
  })
})
