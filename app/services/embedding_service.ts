import { Mistral } from '@mistralai/mistralai'
import db from '@adonisjs/lucid/services/db'
import aiConfig from '#config/ai'
import { toPgVector } from '#shared/helpers/pgvector'
import type Product from '#models/product'

/**
 * Sous-ensemble de l'API Mistral dont dépend ce service. Permet d'injecter un
 * **faux client** en test (aucun appel réseau).
 */
export interface EmbeddingClient {
  embeddings: {
    create(request: {
      model: string
      inputs: string[]
      outputDimension?: number
    }): Promise<{ data: Array<{ embedding?: number[] }> }>
  }
}

/**
 * Client Mistral réel construit depuis la configuration.
 */
function defaultClient(): EmbeddingClient {
  return new Mistral({ apiKey: aiConfig.mistral.apiKey }) as unknown as EmbeddingClient
}

/**
 * Génère des embeddings via Mistral (`mistral-embed`, 1024 dims) et les persiste
 * dans `products.embedding` (pgvector) pour la recherche sémantique. Le client
 * est injecté (testabilité) ; toute la logique ORM/SQL vit ici (controllers et
 * jobs fins).
 */
export default class EmbeddingService {
  constructor(private client: EmbeddingClient = defaultClient()) {}

  /**
   * Embedding d'un texte libre. `null` si le texte est vide ou si l'API ne
   * renvoie pas de vecteur.
   */
  async embed(text: string): Promise<number[] | null> {
    const trimmed = text.trim()
    if (!trimmed) return null

    const response = await this.client.embeddings.create({
      model: aiConfig.mistral.embedModel,
      inputs: [trimmed],
      outputDimension: aiConfig.mistral.dimensions,
    })

    return response.data[0]?.embedding ?? null
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
   * description de chaque traduction préchargée (Mistral-embed est multilingue).
   */
  static productText(product: Product): string {
    return product.translations
      .map((translation) => `${translation.name} ${translation.description ?? ''}`.trim())
      .filter(Boolean)
      .join('\n')
  }
}
