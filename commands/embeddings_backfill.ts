import { inject } from '@adonisjs/core'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import emitter from '@adonisjs/core/services/emitter'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ProductChanged from '#events/product_changed'
import Product from '#models/product'
import EmbeddingService from '#services/embedding_service'
import aiConfig from '#config/ai'

/** Taille des lots lus en base : la mémoire reste bornée quel que soit le catalogue. */
const CHUNK_SIZE = 200

/**
 * Génère les embeddings des produits (recherche sémantique), via le provider IA
 * configuré : `node ace embeddings:backfill`. À lancer une fois après activation
 * de la vectorisation, ou pour rattraper des produits importés en masse.
 *
 * Par défaut, seuls les produits **sans** vecteur. `--all` repasse tous les
 * produits : `EmbeddingService` saute ceux dont la clé d'idempotence est
 * inchangée (même texte, même provider, même modèle) et ne rappelle l'API que
 * pour les autres — c'est le geste à faire après un changement de modèle.
 *
 * Chaque vecteur écrit déclenche la synchronisation de l'index de recherche
 * (`ProductChanged`) : pas besoin de `search:reindex` derrière.
 */
export default class EmbeddingsBackfill extends BaseCommand {
  static commandName = 'embeddings:backfill'
  static description = 'Génère les embeddings des produits (recherche sémantique)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Repasse tous les produits (recalcule ceux dont la clé a changé)' })
  declare all: boolean

  @inject()
  async run(embeddings: EmbeddingService) {
    if (!aiConfig.embeddings.enabled) {
      this.logger.warning(
        'La vectorisation est désactivée : configurez le provider (MISTRAL_API_KEY, ou AI_API_KEY / AI_BASE_URL) et ne mettez pas AI_EMBEDDINGS_ENABLED=false, puis relancez.'
      )
      this.exitCode = 1
      return
    }

    let afterId = 0
    let seen = 0
    let stored = 0
    for (;;) {
      const products = await Product.query()
        .where('id', '>', afterId)
        .if(!this.all, (query) => query.whereNull('embedding'))
        .orderBy('id')
        .limit(CHUNK_SIZE)
        .preload('translations')
      if (products.length === 0) break

      afterId = products[products.length - 1].id
      for (const product of products) {
        seen += 1
        if (await embeddings.embedAndStore(product)) {
          stored += 1
          await emitter.emit(ProductChanged, new ProductChanged(product.id))
        }
      }
      this.logger.info(`${seen} produit(s) examiné(s), ${stored} embedding(s) généré(s)…`)
    }

    this.logger.success(`${stored} embedding(s) généré(s) sur ${seen} produit(s) examiné(s).`)
  }
}
