import { test } from '@japa/runner'
import WorkerProbeService from '#services/worker_probe_service'

test.group('WorkerProbeService', (group) => {
  let probe: WorkerProbeService

  group.each.setup(() => {
    probe = new WorkerProbeService()
    return () => probe.stop()
  })

  test('répond 200 sur GET /health', async ({ assert }) => {
    const port = await probe.start(0, '127.0.0.1')

    const response = await fetch(`http://127.0.0.1:${port}/health`)

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'ok' })
  })

  test('ignore la query string', async ({ assert }) => {
    const port = await probe.start(0, '127.0.0.1')

    const response = await fetch(`http://127.0.0.1:${port}/health?probe=1`)

    assert.equal(response.status, 200)
  })

  test('répond 404 sur un autre chemin ou une autre méthode', async ({ assert }) => {
    const port = await probe.start(0, '127.0.0.1')

    const other = await fetch(`http://127.0.0.1:${port}/`)
    const post = await fetch(`http://127.0.0.1:${port}/health`, { method: 'POST' })

    assert.equal(other.status, 404)
    assert.equal(post.status, 404)
  })

  test("n'écoute plus après stop()", async ({ assert }) => {
    const port = await probe.start(0, '127.0.0.1')
    await probe.stop()

    await assert.rejects(() => fetch(`http://127.0.0.1:${port}/health`))
  })

  test('rejette si le port est déjà pris', async ({ assert }) => {
    const port = await probe.start(0, '127.0.0.1')
    const second = new WorkerProbeService()

    await assert.rejects(() => second.start(port, '127.0.0.1'))
  })
})
