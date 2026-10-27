/** Entrées de la décision d'activer ou non la vectorisation. */
export interface EmbeddingsActivationInput {
  /** `AI_PROVIDER` (`mistral`, `openai-compatible`). */
  provider: string
  /** `AI_EMBEDDINGS_ENABLED` : `undefined` quand la variable n'est pas définie. */
  requested: boolean | undefined
  /** Le provider dispose-t-il des identifiants de son API ? */
  configured: boolean
  nodeEnv: 'development' | 'production' | 'test'
}

/**
 * La vectorisation est-elle active ? (`config/ai.ts`)
 *
 * - variable explicite `false` : coupée, même avec une clé ;
 * - variable explicite `true` : active — et **erreur** si le provider n'est pas
 *   configuré (échec au démarrage plutôt qu'une recherche sémantique qui échoue
 *   en silence) ;
 * - variable absente : active dès que le provider est configuré, sauf en
 *   `NODE_ENV=test` où la suite ne dépend jamais d'un réseau.
 */
export function resolveEmbeddingsEnabled(input: EmbeddingsActivationInput): boolean {
  const { provider, requested, configured, nodeEnv } = input

  if (requested === true && !configured) {
    throw new Error(
      `AI_EMBEDDINGS_ENABLED=true mais le provider « ${provider} » n'est pas configuré ` +
        `(${provider === 'mistral' ? 'MISTRAL_API_KEY' : 'AI_API_KEY ou AI_BASE_URL'} manquant)`
    )
  }
  if (requested !== undefined) return requested
  return nodeEnv !== 'test' && configured
}
