import type { ProductSearchDocument } from '#shared/types/search'

/**
 * Moteur de recherche des produits (#112). Classe abstraite = jeton
 * d'injection (les interfaces n'existent pas au runtime) ; l'implémentation est
 * liée dans `providers/search_provider.ts`.
 *
 * Toutes les écritures sont **idempotentes** : rejouer un lot donne le même
 * index. PostgreSQL reste la source de vérité, ce moteur n'est qu'un index de
 * lecture.
 */
export default abstract class SearchEngine {
  /** `false` pour le moteur inerte (pas de `MEILISEARCH_HOST`). */
  abstract readonly enabled: boolean

  /** Crée ou remplace ces documents (clé : `id`). */
  abstract upsert(documents: ProductSearchDocument[]): Promise<void>

  /** Retire ces produits de l'index (ids absents ignorés). */
  abstract remove(ids: number[]): Promise<void>

  /**
   * Reconstruit tout l'index à partir de ces lots : écrit dans un index
   * temporaire, puis l'échange atomiquement avec l'index actif. Les recherches
   * en cours ne voient jamais un index à moitié rempli, et un échec en route
   * laisse l'ancien index intact. Renvoie le nombre de documents indexés.
   */
  abstract replaceAll(batches: AsyncIterable<ProductSearchDocument[]>): Promise<number>
}
