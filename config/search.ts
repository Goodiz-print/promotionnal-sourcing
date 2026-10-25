import env from '#start/env'
import { resolveEmbeddingsEnabled } from '#shared/helpers/embeddings_activation'
import { SEARCH_EMBEDDING_DIMENSIONS } from '#shared/types/search'

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

const provider = env.get('AI_PROVIDER', 'mistral')

/** Le provider d'embeddings choisi dispose-t-il de quoi appeler son API ? */
function embedderConfigured(): boolean {
  if (provider === 'mistral') return Boolean(env.get('MISTRAL_API_KEY'))
  // Un endpoint compatible OpenAI local (Ollama, vLLM…) n'a pas de clé : l'URL suffit.
  return Boolean(env.get('AI_API_KEY') || env.get('AI_BASE_URL'))
}

const searchConfig = {
  host: env.get('MEILISEARCH_HOST'),
  apiKey: env.get('MEILISEARCH_API_KEY'),
  enabled: Boolean(env.get('MEILISEARCH_HOST')),
  index: `products_${env.get('NODE_ENV')}`,
  /** Taille des lots envoyés à Meilisearch (documents avec vecteurs 1024 dim). */
  batchSize: 500,
  /**
   * Délai maximal d'attente d'une tâche Meilisearch (ms). Large : quand
   * l'embedder est actif, Meilisearch appelle l'API d'embeddings pendant
   * l'indexation d'un lot.
   */
  taskTimeoutMs: 600_000,
  /**
   * Poids du sémantique dans la recherche hybride (0 = mots-clés, 1 = vecteurs).
   * Point de départ de l'ADR 0002 ; à régler par `node ace search:evaluate`.
   */
  semanticRatio: env.get('SEARCH_SEMANTIC_RATIO', 0.5),
  /**
   * Embedder de Meilisearch (ADR 0002, décision 3) : c'est **Meilisearch** qui
   * appelle l'API d'embeddings, pour les fiches à l'indexation et pour les
   * requêtes à la recherche. **Actif dès que le provider est configuré**
   * (`MISTRAL_API_KEY`, ou `AI_API_KEY` / `AI_BASE_URL` avec
   * `AI_PROVIDER=openai-compatible`) ; sans identifiants, la recherche reste par
   * mots-clés (dev local, CI). `AI_EMBEDDINGS_ENABLED=false` la coupe même avec
   * une clé ; `=true` sans identifiants échoue au démarrage. En `NODE_ENV=test`,
   * coupé sauf demande explicite.
   */
  embedder: {
    enabled: resolveEmbeddingsEnabled({
      provider,
      requested: env.get('AI_EMBEDDINGS_ENABLED'),
      configured: embedderConfigured(),
      nodeEnv: env.get('NODE_ENV'),
    }),
    /** `mistral` (API Mistral) ou `openai-compatible` (OpenAI, Together, Ollama, vLLM…). */
    provider,
    url:
      provider === 'mistral'
        ? MISTRAL_EMBEDDINGS_URL
        : `${env.get('AI_BASE_URL', 'https://api.openai.com/v1')}/embeddings`,
    apiKey: provider === 'mistral' ? env.get('MISTRAL_API_KEY') : env.get('AI_API_KEY'),
    model:
      provider === 'mistral'
        ? env.get('MISTRAL_EMBED_MODEL', 'mistral-embed')
        : env.get('AI_EMBED_MODEL', 'text-embedding-3-small'),
    dimensions: SEARCH_EMBEDDING_DIMENSIONS,
  },
}

export default searchConfig
