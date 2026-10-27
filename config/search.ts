import env from '#start/env'
import { resolveEmbeddingsEnabled } from '#shared/helpers/embeddings_activation'
import {
  DEFAULT_EMBEDDER_PROVIDER,
  DEFAULT_HUGGINGFACE_MODEL,
  EMBEDDER_PROVIDERS,
  SEARCH_EMBEDDING_DIMENSIONS,
  type EmbedderProvider,
  type SearchEngineName,
} from '#shared/types/search'

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
const MISTRAL_EMBEDDINGS_URL = 'https://api.mistral.ai/v1/embeddings'

function resolveProvider(): EmbedderProvider {
  const value = env.get('AI_PROVIDER', DEFAULT_EMBEDDER_PROVIDER)
  if (!(EMBEDDER_PROVIDERS as readonly string[]).includes(value)) {
    throw new Error(
      `AI_PROVIDER="${value}" inconnu : valeurs possibles ${EMBEDDER_PROVIDERS.join(', ')}`
    )
  }
  return value as EmbedderProvider
}

const provider = resolveProvider()

/** Moteur actif : Elasticsearch prime (ADR 0004), puis Meilisearch, sinon aucun. */
const engine: SearchEngineName = env.get('ELASTICSEARCH_URL')
  ? 'elasticsearch'
  : env.get('MEILISEARCH_HOST')
    ? 'meilisearch'
    : 'none'

/** Le provider d'embeddings choisi dispose-t-il de ce qu'il lui faut ? */
function embedderConfigured(): boolean {
  // Elasticsearch appelle lui-même l'API Mistral (endpoint d'inférence) : c'est
  // le seul provider qu'il sait porter ici (ADR 0004, décision 3).
  if (engine === 'elasticsearch')
    return provider === 'mistral' && Boolean(env.get('MISTRAL_API_KEY'))
  // Le modèle tourne dans Meilisearch : rien à configurer.
  if (provider === 'huggingface') return true
  if (provider === 'mistral') return Boolean(env.get('MISTRAL_API_KEY'))
  // Un endpoint compatible OpenAI local (Ollama, vLLM…) n'a pas de clé : l'URL suffit.
  return Boolean(env.get('AI_API_KEY') || env.get('AI_BASE_URL'))
}

function embedderUrl(): string {
  if (provider === 'mistral') return MISTRAL_EMBEDDINGS_URL
  if (provider === 'openai-compatible') {
    return `${env.get('AI_BASE_URL', 'https://api.openai.com/v1')}/embeddings`
  }
  return ''
}

function embedderModel(): string {
  if (provider === 'huggingface') return env.get('HF_EMBED_MODEL', DEFAULT_HUGGINGFACE_MODEL)
  if (provider === 'mistral') return env.get('MISTRAL_EMBED_MODEL', 'mistral-embed')
  return env.get('AI_EMBED_MODEL', 'text-embedding-3-small')
}

const searchConfig = {
  engine,
  host: env.get('MEILISEARCH_HOST'),
  apiKey: env.get('MEILISEARCH_API_KEY'),
  /** Elasticsearch managé (ADR 0004). */
  elasticsearch: {
    url: env.get('ELASTICSEARCH_URL'),
    username: env.get('ELASTICSEARCH_USER'),
    password: env.get('ELASTICSEARCH_PASSWORD'),
    /** Endpoint d'inférence créé dans le cluster, un par environnement. */
    inferenceId: `embeddings_${env.get('NODE_ENV')}`,
  },
  enabled: engine !== 'none',
  index: `products_${env.get('NODE_ENV')}`,
  /** Taille des lots de documents envoyés à Meilisearch. */
  batchSize: 500,
  /**
   * Délai maximal d'attente d'une tâche Meilisearch (ms). Large : quand
   * l'embedder est actif, Meilisearch calcule les vecteurs pendant l'indexation
   * d'un lot (et télécharge d'abord le modèle `huggingface` la première fois).
   */
  taskTimeoutMs: 600_000,
  /**
   * Poids du sémantique dans la recherche hybride (0 = mots-clés, 1 = vecteurs).
   * Point de départ de l'ADR 0002 ; à régler par `node ace search:evaluate`.
   */
  semanticRatio: env.get('SEARCH_SEMANTIC_RATIO', 0.5),
  /**
   * Embedder de Meilisearch (ADR 0002, décision 3) : c'est **Meilisearch** qui
   * calcule les vecteurs, pour les fiches à l'indexation et pour les requêtes à
   * la recherche. Par défaut (`huggingface`), il fait tourner un modèle
   * multilingue open-weight lui-même : **aucune clé à fournir**. `mistral` et
   * `openai-compatible` appellent une API d'embeddings.
   *
   * **Actif par défaut** quand le provider est utilisable ; `AI_EMBEDDINGS_ENABLED=false`
   * le coupe (recherche par mots-clés seuls), `=true` avec un provider API sans
   * identifiants échoue au démarrage. En `NODE_ENV=test`, coupé sauf demande
   * explicite.
   */
  embedder: {
    enabled: resolveEmbeddingsEnabled({
      provider,
      requested: env.get('AI_EMBEDDINGS_ENABLED'),
      configured: embedderConfigured(),
      nodeEnv: env.get('NODE_ENV'),
    }),
    provider,
    /** Endpoint de l'API d'embeddings (providers `mistral` et `openai-compatible`). */
    url: embedderUrl(),
    apiKey: provider === 'mistral' ? env.get('MISTRAL_API_KEY') : env.get('AI_API_KEY'),
    model: embedderModel(),
    /** Dimension demandée aux API ; le modèle `huggingface` impose la sienne. */
    dimensions: SEARCH_EMBEDDING_DIMENSIONS,
  },
}

export default searchConfig
