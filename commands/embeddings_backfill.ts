import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Génère les embeddings manquants des produits (recherche sémantique), via le
 * provider IA configuré. À lancer une fois après activation de l'IA, ou pour
 * rattraper des produits importés en masse : `node ace embeddings:backfill`.
 */
export default class EmbeddingsBackfill extends BaseCommand {
  static commandName = 'embeddings:backfill'
  static description = 'Génère les embeddings manquants des produits (recherche sémantique)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { default: aiConfig } = await import('#config/ai')
    if (!aiConfig.embeddings.enabled) {
      this.logger.warning(
        'AI_EMBEDDINGS_ENABLED est faux : activez-le et configurez le provider (AI_PROVIDER), puis relancez.'
      )
      return
    }

    const { default: Product } = await import('#models/product')
    const { default: EmbeddingService } = await import('#services/embedding_service')

    const service = await this.app.container.make(EmbeddingService)
    const products = await Product.query().whereNull('embedding').preload('translations')

    this.logger.info(`${products.length} produit(s) sans embedding.`)

    let stored = 0
    for (const product of products) {
      if (await service.embedAndStore(product)) stored += 1
    }

    this.logger.success(`${stored} embedding(s) généré(s).`)
  }
}
