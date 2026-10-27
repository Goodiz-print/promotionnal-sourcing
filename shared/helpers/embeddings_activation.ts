/** Entrées de la décision d'activer ou non la vectorisation. */
export interface EmbeddingsActivationInput {
  /** `AI_EMBEDDINGS_ENABLED` : `undefined` quand la variable n'est pas définie. */
  requested: boolean | undefined
  /** `MISTRAL_API_KEY` est-elle définie ? */
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
  const { requested, configured, nodeEnv } = input

  if (requested === true && !configured) {
    throw new Error('AI_EMBEDDINGS_ENABLED=true mais MISTRAL_API_KEY manquant')
  }
  if (requested !== undefined) return requested
  return nodeEnv !== 'test' && configured
}
