import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Génère les embeddings Mistral manquants des produits (recherche sémantique).
 * À lancer une fois après activation de l'IA, ou pour rattraper des produits
 * importés en masse : `node ace embeddings:backfill`.
 */
export default class EmbeddingsBackfill extends BaseCommand {
  static commandName = 'embeddings:backfill'
  static description = 'Génère les embeddings Mistral manquants des produits (recherche sémantique)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { default: aiConfig } = await import('#config/ai')
    if (!aiConfig.embeddings.enabled) {
      this.logger.warning(
        'AI_EMBEDDINGS_ENABLED est faux : activez-le et posez MISTRAL_API_KEY, puis relancez.'
      )
      return
    }

    const { default: Product } = await import('#models/product')
    const { default: EmbeddingService } = await import('#services/embedding_service')

    const service = new EmbeddingService()
    const products = await Product.query().whereNull('embedding').preload('translations')

    this.logger.info(`${products.length} produit(s) sans embedding.`)

    let stored = 0
    for (const product of products) {
      if (await service.embedAndStore(product)) stored += 1
    }

    this.logger.success(`${stored} embedding(s) généré(s).`)
  }
}
