import env from '#start/env'
import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { dbAssertions } from '@adonisjs/lucid/plugins/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { authApiClient } from '@adonisjs/auth/plugins/api_client'
import { shieldApiClient } from '@adonisjs/shield/plugins/api_client'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'
import { inertiaApiClient } from '@adonisjs/inertia/plugins/api_client'

/**
 * This file is imported by the "bin/test.ts" entrypoint file
 */

/**
 * Configure Japa plugins in the plugins array.
 * Learn more - https://japa.dev/docs/runner-config#plugins-optional
 */
export const plugins: Config['plugins'] = [
  assert(),
  apiClient(),
  pluginAdonisJS(app),
  dbAssertions(app),
  inertiaApiClient(app),
  sessionApiClient(app),
  shieldApiClient(),
  authApiClient(app),
]

/**
 * Configure lifecycle function to run before and after all the
 * tests.
 *
 * The setup functions are executed before all the tests
 * The teardown functions are executed after all the tests
 */
/**
 * Garde-fou : la suite tronque toutes les tables au fil des groupes. Un
 * `DB_DATABASE` hérité de `.env` (base de développement) détruirait donc les
 * données locales sans prévenir. On refuse de démarrer si le nom de la base ne
 * se termine pas par `test`.
 */
function assertTestDatabase(): void {
  const database = env.get('DB_DATABASE')
  if (database.endsWith('test')) return

  // `process.exit` plutôt qu'un `throw` : une exception levée dans un hook
  // global laisse le runner Japa avec ses handles ouverts (`forceExit: false`
  // dans `adonisrc.ts`) — le message s'affiche mais le process ne rend jamais
  // la main.
  console.error(
    `\nBase de données "${database}" refusée : la suite tronque toutes les tables et ` +
      `n'accepte qu'une base dont le nom se termine par "test".\n` +
      `Lancer \`pnpm test:db\` puis \`pnpm test\` (cf. docs/tests.md).\n`
  )
  process.exit(1)
}

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [() => assertTestDatabase()],
  teardown: [],
}

/**
 * Configure suites by tapping into the test suite instance.
 * Learn more - https://japa.dev/docs/test-suites#lifecycle-hooks
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
