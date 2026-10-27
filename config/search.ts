import env from '#start/env'
import { resolveEmbeddingsEnabled } from '#shared/helpers/embeddings_activation'
import type { SearchEngineName } from '#shared/types/search'

/**
 * Configuration de la recherche (#112, ADR 0004). PostgreSQL reste la source de
 * vérité ; Elasticsearch est un index de lecture alimenté par la queue.
 *
 * **Désactivé sans `ELASTICSEARCH_URL`** (dev, test, CI) : l'indexation devient
 * un no-op et aucune connexion n'est tentée.
 *
 * `index` est préfixé par l'environnement : un cluster partagé entre
 * `development` et `staging` ne mélange pas leurs fiches.
 */
const engine: SearchEngineName = env.get('ELASTICSEARCH_URL') ? 'elasticsearch' : 'none'

const searchConfig = {
  engine,
  /** Elasticsearch managé (add-on Clever Cloud). */
  elasticsearch: {
    url: env.get('ELASTICSEARCH_URL'),
    username: env.get('ELASTICSEARCH_USER'),
    password: env.get('ELASTICSEARCH_PASSWORD'),
    /** Endpoint d'inférence créé dans le cluster, un par environnement. */
    inferenceId: `embeddings_${env.get('NODE_ENV')}`,
  },
  enabled: engine !== 'none',
  index: `products_${env.get('NODE_ENV')}`,
  /** Taille des lots de documents envoyés au moteur. */
  batchSize: 500,
  /**
   * Délai maximal d'une requête vers le moteur (ms). Large : à l'indexation d'un
   * lot, Elasticsearch attend les vecteurs de l'API d'embeddings.
   */
  taskTimeoutMs: 600_000,
  /**
   * Poids du sémantique dans la recherche hybride (0 = mots-clés, 1 = vecteurs).
   * Point de départ de l'ADR 0002 ; à régler par `node ace search:evaluate`.
   */
  semanticRatio: env.get('SEARCH_SEMANTIC_RATIO', 0.5),
  /**
   * Embeddings (ADR 0004, décision 3) : c'est **Elasticsearch** qui calcule les
   * vecteurs, pour les fiches à l'indexation et pour les requêtes à la recherche,
   * en appelant l'API Mistral par un endpoint d'inférence que l'application crée
   * dans le cluster. L'application n'appelle jamais l'API.
   *
   * **Actif par défaut** dès que `MISTRAL_API_KEY` est définie ;
   * `AI_EMBEDDINGS_ENABLED=false` le coupe (mots-clés seuls), `=true` sans clé
   * échoue au démarrage. En `NODE_ENV=test`, coupé sauf demande explicite.
   */
  embedder: {
    enabled: resolveEmbeddingsEnabled({
      requested: env.get('AI_EMBEDDINGS_ENABLED'),
      configured: Boolean(env.get('MISTRAL_API_KEY')),
      nodeEnv: env.get('NODE_ENV'),
    }),
    apiKey: env.get('MISTRAL_API_KEY'),
    model: env.get('MISTRAL_EMBED_MODEL', 'mistral-embed'),
  },
}

export default searchConfig
