import pg from 'pg'
import logger from '@adonisjs/core/services/logger'
import type { Serializable, SubscribeHandler, Transport } from '@boringnode/bus/types/main'
import {
  TRANSMIT_PG_CHANNEL,
  TRANSMIT_PG_MAX_PAYLOAD_BYTES,
  type TransmitEnvelope,
} from '#shared/types/realtime'

const RECONNECT_MIN_MS = 500
const RECONNECT_MAX_MS = 30_000
const LISTENER_APPLICATION_NAME = 'transmit-bus-listener'

/**
 * Transport Transmit partagé entre les instances web, sur PostgreSQL
 * (`LISTEN` / `NOTIFY`) : aucune brique de plus à exploiter (ADR 0003). Une
 * diffusion faite par une instance atteint les abonnés connectés aux autres.
 *
 * Un seul canal PostgreSQL (`TRANSMIT_PG_CHANNEL`) porte tout ; le nom du canal
 * Transmit voyage dans l'enveloppe et chaque instance route localement. Deux
 * connexions par instance : une **dédiée** à l'écoute (`LISTEN` exige une
 * session, donc pas de pooler en mode transaction devant la base), un petit pool
 * pour `pg_notify`. Rien ne se connecte avant le premier usage — un worker ou une
 * commande ace qui ne diffuse pas n'ouvre aucune connexion.
 *
 * Limites : `NOTIFY` plafonne la charge à ~8 000 octets (les événements
 * temps réel ne portent que des identifiants) ; un message trop gros est loggué
 * et abandonné, le rejouer ne servirait à rien. La livraison est au mieux : une
 * instance déconnectée rate les messages émis pendant la coupure, elle se
 * réabonne seule. Le temps réel n'est qu'un confort — l'état fait foi en base.
 */
export default class PostgresTransport implements Transport {
  #id?: string
  #config: pg.ClientConfig
  #listener?: pg.Client
  #listening?: Promise<void>
  #publisher?: pg.Pool
  #handlers = new Map<string, SubscribeHandler<never>>()
  #reconnectCallbacks: Array<() => void> = []
  #reconnectDelay = RECONNECT_MIN_MS
  #reconnectTimer?: NodeJS.Timeout
  #closed = false

  constructor(config: pg.ClientConfig) {
    this.#config = config
  }

  setId(id: string): this {
    this.#id = id
    return this
  }

  onReconnect(callback: () => void): void {
    this.#reconnectCallbacks.push(callback)
  }

  async subscribe<T extends Serializable>(
    channel: string,
    handler: SubscribeHandler<T>
  ): Promise<void> {
    this.#handlers.set(channel, handler as SubscribeHandler<never>)
    await this.#listen()
  }

  async unsubscribe(channel: string): Promise<void> {
    this.#handlers.delete(channel)
  }

  async publish(channel: string, message: Serializable): Promise<void> {
    if (!this.#id) throw new Error('You must set an id before publishing a message')

    const envelope: TransmitEnvelope = { channel, busId: this.#id, payload: message }
    const body = JSON.stringify(envelope)
    if (Buffer.byteLength(body) > TRANSMIT_PG_MAX_PAYLOAD_BYTES) {
      logger.error(
        { channel, bytes: Buffer.byteLength(body) },
        'transmit message too large, dropped'
      )
      return
    }

    this.#publisher ??= new pg.Pool({ ...this.#config, max: 1 })
    await this.#publisher.query('SELECT pg_notify($1, $2)', [TRANSMIT_PG_CHANNEL, body])
  }

  async disconnect(): Promise<void> {
    this.#closed = true
    clearTimeout(this.#reconnectTimer)
    const listener = this.#listener
    this.#listener = undefined
    this.#listening = undefined
    await Promise.allSettled([listener?.end(), this.#publisher?.end()])
    this.#publisher = undefined
  }

  /** Ouvre l'écoute une seule fois, même si plusieurs `subscribe` arrivent ensemble. */
  #listen(): Promise<void> {
    this.#listening ??= this.#connectListener().catch((error) => {
      this.#listening = undefined
      throw error
    })
    return this.#listening
  }

  async #connectListener(): Promise<void> {
    const client = new pg.Client({
      ...this.#config,
      application_name: LISTENER_APPLICATION_NAME,
    })
    client.on('notification', (notification) => this.#dispatch(notification.payload))
    client.on('error', (error) => {
      logger.warn({ err: error }, 'transmit listener error')
    })
    client.on('end', () => this.#onListenerEnded(client))

    await client.connect()
    await client.query(`LISTEN ${TRANSMIT_PG_CHANNEL}`)
    this.#listener = client
    this.#reconnectDelay = RECONNECT_MIN_MS
  }

  #dispatch(body: string | undefined): void {
    if (!body) return
    try {
      const { channel, busId, payload } = JSON.parse(body) as TransmitEnvelope
      if (busId === this.#id) return
      const handler = this.#handlers.get(channel)
      if (handler) (handler as SubscribeHandler<Serializable>)(payload as Serializable)
    } catch (error) {
      logger.warn({ err: error }, 'transmit message ignored: unreadable envelope')
    }
  }

  /** Perte de la connexion d'écoute : on s'en remet à `#scheduleReconnect`. */
  #onListenerEnded(ended: pg.Client): void {
    if (this.#closed || this.#listener !== ended) return
    this.#listener = undefined
    this.#listening = undefined
    this.#scheduleReconnect()
  }

  /** Reconnexion avec attente croissante ; les abonnements locaux sont conservés. */
  #scheduleReconnect(): void {
    if (this.#closed) return

    const delay = this.#reconnectDelay
    this.#reconnectDelay = Math.min(delay * 2, RECONNECT_MAX_MS)
    this.#reconnectTimer = setTimeout(() => {
      this.#listen()
        .then(() => {
          logger.info('transmit listener reconnected')
          for (const callback of this.#reconnectCallbacks) callback()
        })
        .catch((error) => {
          logger.warn({ err: error }, 'transmit listener reconnect failed')
          this.#scheduleReconnect()
        })
    }, delay)
  }
}
