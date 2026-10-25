import { defineConfig } from '@adonisjs/transmit'
import env from '#start/env'
import PostgresTransport from '#services/realtime/postgres_transport'

/**
 * Transport du temps réel. `memory` (défaut) ne diffuse qu'aux abonnés de la
 * même instance ; `postgres` relaie par LISTEN/NOTIFY entre les instances web
 * (ADR 0003 : web ×2). Le worker n'est pas concerné : il ne tient aucun abonné.
 */
const transport =
  env.get('TRANSMIT_TRANSPORT') === 'postgres'
    ? {
        driver: () =>
          new PostgresTransport({
            host: env.get('DB_HOST'),
            port: env.get('DB_PORT'),
            user: env.get('DB_USER'),
            password: env.get('DB_PASSWORD'),
            database: env.get('DB_DATABASE'),
          }),
      }
    : null

export default defineConfig({
  pingInterval: false,
  transport,
})
