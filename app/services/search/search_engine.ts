import type { SearchEngineInfo } from '#shared/types/admin_search'
import type {
  FacetDistribution,
  FacetDistributionRequest,
  ProductSearchDocument,
  ProductSearchHits,
  ProductSearchRequest,
} from '#shared/types/search'

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

  /**
   * Recherche hybride (mots-clés + vecteur) filtrée. Renvoie des identifiants
   * ordonnés par pertinence : l'appelant recharge les produits depuis PostgreSQL.
   * Lève si le moteur est injoignable.
   */
  abstract search(request: ProductSearchRequest): Promise<ProductSearchHits>

  /**
   * Distributions de facettes (`facetDistribution`) des champs demandés, pour le
   * filtre donné : par champ (`attributes.color`), le nombre de produits par
   * valeur. Sert la barre de filtres dépendante de la catégorie — ne recharge
   * rien depuis PostgreSQL, ne renvoie pas de produits. Lève si le moteur est
   * injoignable.
   */
  abstract facetDistribution(request: FacetDistributionRequest): Promise<FacetDistribution>

  /** Retire ces produits de l'index (ids absents ignorés). */
  abstract remove(ids: number[]): Promise<void>

  /**
   * Reconstruit tout l'index à partir de ces lots : écrit dans un index
   * temporaire, puis l'échange atomiquement avec l'index actif. Les recherches
   * en cours ne voient jamais un index à moitié rempli, et un échec en route
   * laisse l'ancien index intact. Renvoie le nombre de documents indexés.
   */
  abstract replaceAll(batches: AsyncIterable<ProductSearchDocument[]>): Promise<number>

  /**
   * Réapplique les réglages de l'index courant (attributs filtrables, etc.)
   * sans reconstruire les documents. Utile quand `is_filter` d'un attribut
   * change : la liste des facettes aplaties (`attributes.<slug>`) doit être
   * mise à jour dans les réglages. No-op si l'index n'existe pas encore.
   */
  abstract refreshSettings(): Promise<void>
  /**
   * État de l'index actif (existence, nombre de documents, écritures en cours,
   * tâches récentes) pour le back-office (#176). Lève si le moteur est
   * injoignable : l'appelant en fait une alerte.
   */
  abstract inspect(): Promise<SearchEngineInfo>

  /**
   * Identifiants des documents de l'index actif, par lots (écart avec
   * PostgreSQL, #176). Vide si l'index n'existe pas encore. Lève si le moteur
   * est injoignable.
   */
  abstract documentIds(): AsyncIterable<number[]>
}
