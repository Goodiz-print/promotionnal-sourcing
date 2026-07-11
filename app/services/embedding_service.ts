import db from '@adonisjs/lucid/services/db'
import aiConfig from '#config/ai'
import { toPgVector } from '#shared/helpers/pgvector'
import { resolveEmbeddingProvider } from '#services/embeddings/provider_factory'
import { EmbeddingDimensionError } from '#exceptions/ai_errors'
import type { EmbeddingProvider } from '#shared/types/ai'
import type Product from '#models/product'

/**
 * Orchestration des embeddings produits : délègue le calcul au **provider**
 * configuré (`AI_PROVIDER` : Mistral, OpenAI-compatible…) puis persiste le
 * vecteur dans `products.embedding` (pgvector) pour la recherche sémantique.
 * Le provider est injecté (testabilité) ; toute la logique ORM/SQL vit ici
 * (controllers et jobs fins).
 */
export default class EmbeddingService {
  constructor(private provider: EmbeddingProvider = resolveEmbeddingProvider()) {}

  /**
   * Embedding d'un texte libre. `null` si le texte est vide. Lève
   * `EmbeddingDimensionError` si le provider ne renvoie pas la dimension
   * attendue (colonne `products.embedding` figée à `dimensions`).
   */
  async embed(text: string): Promise<number[] | null> {
    const trimmed = text.trim()
    if (!trimmed) return null

    const vector = await this.provider.embed(trimmed)
    if (vector.length !== aiConfig.embeddings.dimensions) {
      throw new EmbeddingDimensionError(vector.length, aiConfig.embeddings.dimensions)
    }
    return vector
  }

  /**
   * Calcule et persiste l'embedding d'un produit (nom + description, toutes
   * locales préchargées). Renvoie `true` si un vecteur a été écrit.
   */
  async embedAndStore(product: Product): Promise<boolean> {
    const text = EmbeddingService.productText(product)
    if (!text) return false

    const vector = await this.embed(text)
    if (!vector) return false

    await db.rawQuery('UPDATE products SET embedding = ?::vector WHERE id = ?', [
      toPgVector(vector),
      product.id,
    ])
    return true
  }

  /**
   * Texte représentatif d'un produit pour l'embedding : concatène nom +
   * description de chaque traduction préchargée (les modèles d'embedding
   * modernes sont multilingues).
   */
  static productText(product: Product): string {
    return product.translations
      .map((translation) => `${translation.name} ${translation.description ?? ''}`.trim())
      .filter(Boolean)
      .join('\n')
  }
}
