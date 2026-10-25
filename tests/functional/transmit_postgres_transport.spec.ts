import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import transmitConfig from '#config/transmit'
import PostgresTransport from '#services/realtime/postgres_transport'
import { TRANSMIT_PG_MAX_PAYLOAD_BYTES } from '#shared/types/realtime'
import { useDatabase } from '#tests/utils/setup'
import type pg from 'pg'

/**
 * Transport Transmit partagé par PostgreSQL (LISTEN / NOTIFY) : deux instances
 * (`web-1`, `web-2`) se relaient les diffusions, sans se rejouer les leurs.
 */
function connection(): pg.ClientConfig {
  return {
    host: env.get('DB_HOST'),
    port: env.get('DB_PORT'),
    user: env.get('DB_USER'),
    password: env.get('DB_PASSWORD'),
    database: env.get('DB_DATABASE'),
  }
}

async function until(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('condition not met in time')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

/** Laisse le temps à un message éventuel d'arriver, pour prouver qu'il n'arrive pas. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 300))

test.group('Transmit — transport PostgreSQL', (group) => {
  useDatabase(group, { seed: 'none' })

  const transports: PostgresTransport[] = []
  function instance(id: string) {
    const transport = new PostgresTransport(connection()).setId(id)
    transports.push(transport)
    return transport
  }
  group.each.teardown(async () => {
    await Promise.all(transports.splice(0).map((transport) => transport.disconnect()))
  })

  test('une diffusion d’une instance atteint l’autre', async ({ assert }) => {
    const web1 = instance('web-1')
    const web2 = instance('web-2')
    const received: unknown[] = []
    await web2.subscribe('notifications/users/7', (payload) => void received.push(payload))

    await web1.publish('notifications/users/7', { type: 'notification.created', notificationId: 3 })

    await until(() => received.length === 1)
    assert.deepEqual(received, [{ type: 'notification.created', notificationId: 3 }])
  })

  test('une instance ne se rejoue pas ses propres messages', async ({ assert }) => {
    const web1 = instance('web-1')
    const received: unknown[] = []
    await web1.subscribe('notifications/users/7', (payload) => void received.push(payload))

    await web1.publish('notifications/users/7', { n: 1 })
    await settle()

    assert.deepEqual(received, [])
  })

  test('chaque message va au handler de son canal, et seulement lui', async ({ assert }) => {
    const web1 = instance('web-1')
    const web2 = instance('web-2')
    const seven: unknown[] = []
    const eight: unknown[] = []
    await web2.subscribe('notifications/users/7', (payload) => void seven.push(payload))
    await web2.subscribe('notifications/users/8', (payload) => void eight.push(payload))

    await web1.publish('notifications/users/8', { for: 'eight' })
    await web1.publish('notifications/users/9', { for: 'nobody' })

    await until(() => eight.length === 1)
    await settle()
    assert.deepEqual(eight, [{ for: 'eight' }])
    assert.deepEqual(seven, [])
  })

  test('après unsubscribe, plus rien n’est reçu', async ({ assert }) => {
    const web1 = instance('web-1')
    const web2 = instance('web-2')
    const received: unknown[] = []
    await web2.subscribe('c', (payload) => void received.push(payload))
    await web2.unsubscribe('c')

    await web1.publish('c', { n: 1 })
    await settle()

    assert.deepEqual(received, [])
  })

  test('un message trop gros pour NOTIFY est abandonné sans erreur ni blocage', async ({
    assert,
  }) => {
    const web1 = instance('web-1')
    const web2 = instance('web-2')
    const received: unknown[] = []
    await web2.subscribe('c', (payload) => void received.push(payload))

    await web1.publish('c', { blob: 'x'.repeat(TRANSMIT_PG_MAX_PAYLOAD_BYTES) })
    await web1.publish('c', { small: true })

    await until(() => received.length === 1)
    assert.deepEqual(received, [{ small: true }])
  })

  test('publier exige un identifiant d’instance', async ({ assert }) => {
    const transport = new PostgresTransport(connection())
    transports.push(transport)

    await assert.rejects(() => transport.publish('c', {}), /id before publishing/)
  })

  test('la connexion d’écoute coupée est rétablie, abonnements conservés', async ({ assert }) => {
    const web1 = instance('web-1')
    const web2 = instance('web-2')
    const received: unknown[] = []
    let reconnected = 0
    web2.onReconnect(() => (reconnected += 1))
    await web2.subscribe('c', (payload) => void received.push(payload))

    await db.rawQuery(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE application_name = 'transmit-bus-listener' AND pid <> pg_backend_pid()`
    )
    await until(() => reconnected === 1)

    await web1.publish('c', { after: 'reconnect' })
    await until(() => received.length === 1)
    assert.deepEqual(received, [{ after: 'reconnect' }])
  })

  test('sans TRANSMIT_TRANSPORT=postgres, Transmit reste en mémoire', ({ assert }) => {
    assert.isNull(transmitConfig.transport)
  })
})
