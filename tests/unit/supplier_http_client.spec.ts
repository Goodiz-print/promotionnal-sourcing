import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from '@japa/runner'
import supplierFeedsConfig from '#config/supplier_feeds'
import SupplierHttpClient from '#services/supplier_feed/supplier_http_client'
import { SupplierFeedHttpException } from '#exceptions/supplier_feed_errors'

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

test.group('Client HTTP des flux — cache disque', (group) => {
  let calls: { url: string; headers: Record<string, string> }[] = []
  let responses: Array<() => Response> = []

  group.each.setup(async () => {
    const http = supplierFeedsConfig.http
    const previous = {
      directory: http.cacheDirectory,
      ttl: http.cacheTtlMs,
      fetch: globalThis.fetch,
    }
    http.cacheDirectory = await mkdtemp(join(tmpdir(), 'supplier-feeds-'))
    calls = []
    responses = []
    globalThis.fetch = (async (input: unknown, init?: { headers?: Record<string, string> }) => {
      calls.push({ url: String(input), headers: init?.headers ?? {} })
      const next = responses.shift()
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

  const json = (value: unknown) => () => Response.json(value)
  const cached = () => readdir(supplierFeedsConfig.http.cacheDirectory)

  test('une copie fraîche est réutilisée sans nouvel appel', async ({ assert }) => {
    responses = [json({ version: 1 })]
    const client = new SupplierHttpClient()

    assert.deepEqual(await client.getJson(URL, {}, { refresh: false }), { version: 1 })
    assert.deepEqual(await client.getJson(URL, {}, { refresh: false }), { version: 1 })
    assert.lengthOf(calls, 1)
    // Nom de fichier = empreinte : ni l'URL ni un secret en clair.
    const [file] = await cached()
    assert.match(file, /^[0-9a-f]{64}\.json$/)
  })

  test('--refresh et copie périmée retéléchargent', async ({ assert }) => {
    responses = [json({ version: 1 }), json({ version: 2 }), json({ version: 3 })]
    const client = new SupplierHttpClient()

    await client.getJson(URL, {}, { refresh: false })
    assert.deepEqual(await client.getJson(URL, {}, { refresh: true }), { version: 2 })
    // Durée de vie négative : la copie est périmée quelle que soit la précision de l'horodatage.
    supplierFeedsConfig.http.cacheTtlMs = -1
    assert.deepEqual(await client.getJson(URL, {}, { refresh: false }), { version: 3 })
    assert.lengthOf(calls, 3)
    assert.lengthOf(await cached(), 1)
  })

  test('cache rattaché au compte : en-têtes distincts, ou scope commun', async ({ assert }) => {
    responses = [json({ account: 'a' }), json({ account: 'b' }), json({ account: 'scoped' })]
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
    assert.lengthOf(calls, 3)
  })

  test('téléchargement coupé : retenté, aucun fichier partiel laissé', async ({ assert }) => {
    responses = [() => new Response(brokenBody()), json({ version: 1 })]
    const client = new SupplierHttpClient()

    assert.deepEqual(await client.getJson(URL, {}, { refresh: false }), { version: 1 })
    assert.lengthOf(calls, 2)
    const files = await cached()
    assert.deepEqual(
      files.filter((file) => file.endsWith('.part')),
      []
    )
  })

  test('téléchargement toujours coupé : erreur, rien en cache', async ({ assert }) => {
    const attempts = supplierFeedsConfig.http.retries + 1
    responses = Array.from({ length: attempts }, () => () => new Response(brokenBody()))
    await assert.rejects(
      () => new SupplierHttpClient().getJson(URL, {}, { refresh: false }),
      SupplierFeedHttpException
    )
    assert.lengthOf(calls, attempts)
    assert.deepEqual(await cached(), [])
  })

  test('réponse illisible : erreur et copie supprimée', async ({ assert }) => {
    responses = [() => new Response('<html>maintenance</html>')]
    await assert.rejects(
      () => new SupplierHttpClient().getJson(URL, {}, { refresh: false }),
      SupplierFeedHttpException
    )
    assert.deepEqual(await cached(), [])
  })

  test('sans cache : rien n’est écrit sur disque', async ({ assert }) => {
    responses = [json({ version: 1 })]
    assert.deepEqual(await new SupplierHttpClient().getJson(URL), { version: 1 })
    assert.deepEqual(await cached(), [])
  })
})
