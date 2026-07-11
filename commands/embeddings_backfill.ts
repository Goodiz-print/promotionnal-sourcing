import { inject } from '@adonisjs/core'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Product from '#models/product'
import EmbeddingService from '#services/embedding_service'
import aiConfig from '#config/ai'

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

  @inject()
  async run(embeddings: EmbeddingService) {
    if (!aiConfig.embeddings.enabled) {
      this.logger.warning(
        'AI_EMBEDDINGS_ENABLED est faux : activez-le et configurez le provider (AI_PROVIDER), puis relancez.'
      )
      return
    }

    const products = await Product.query().whereNull('embedding').preload('translations')

    this.logger.info(`${products.length} produit(s) sans embedding.`)

    let stored = 0
    for (const product of products) {
      if (await embeddings.embedAndStore(product)) stored += 1
    }

    this.logger.success(`${stored} embedding(s) généré(s).`)
  }
}
