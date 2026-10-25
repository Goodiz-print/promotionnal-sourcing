import env from '#start/env'

/**
 * Configuration de la recherche (#112). PostgreSQL reste la source de vérité ;
 * Meilisearch est un index de lecture alimenté par la queue.
 *
 * **Désactivé sans `MEILISEARCH_HOST`** (dev, test, CI) : l'indexation devient un
 * no-op et aucune connexion n'est tentée.
 *
 * `index` est préfixé par l'environnement : un Meilisearch partagé entre
 * `development` et `staging` ne mélange pas leurs fiches.
 */
const searchConfig = {
  host: env.get('MEILISEARCH_HOST'),
  apiKey: env.get('MEILISEARCH_API_KEY'),
  enabled: Boolean(env.get('MEILISEARCH_HOST')),
  index: `products_${env.get('NODE_ENV')}`,
  /** Taille des lots envoyés à Meilisearch (documents avec vecteurs 1024 dim). */
  batchSize: 500,
  /** Délai maximal d'attente d'une tâche Meilisearch (ms). */
  taskTimeoutMs: 120_000,
}

export default searchConfig
