import type { AiProvider } from '#shared/types/ai'

/**
 * Token d'injection (classe abstraite) des drivers d'embeddings. Lié à une
 * implémentation concrète dans `providers/ai_provider.ts` selon `AI_PROVIDER`,
 * puis injecté dans `EmbeddingService`. Classe abstraite (et non interface) car
 * le conteneur IoC a besoin d'un token existant au runtime.
 */
export default abstract class EmbeddingProvider {
  /** Identifiant du provider (messages d'erreur / logs). */
  abstract readonly name: AiProvider

  /** Modèle d'embedding utilisé (entre dans la clé d'idempotence). */
  abstract readonly model: string

  /** Embedding d'un texte non vide. Lève en cas d'échec API. */
  abstract embed(text: string): Promise<number[]>
}
