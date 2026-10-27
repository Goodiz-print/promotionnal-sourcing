import { inject } from '@adonisjs/core'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ProductIndexService from '#services/product_index_service'

/**
 * Reconstruit tout l'index de recherche depuis PostgreSQL (#112) : à lancer au
 * premier déploiement de Meilisearch, après une perte de l'index, ou pour
 * rattraper un écart : `node ace search:reindex`.
 *
 * Sûre à relancer à tout moment : l'index est construit à côté puis échangé
 * atomiquement, un échec laisse l'ancien en place.
 */
export default class SearchReindex extends BaseCommand {
  static commandName = 'search:reindex'
  static description = "Reconstruit l'index de recherche des produits depuis PostgreSQL"

  static options: CommandOptions = {
    startApp: true,
  }

  @inject()
  async run(index: ProductIndexService) {
    if (!index.enabled) {
      this.logger.warning('MEILISEARCH_HOST est absent : renseignez-le, puis relancez.')
      return
    }

    this.logger.info('Réindexation complète en cours…')
    const count = await index.reindexAll()
    this.logger.success(`${count} produit(s) indexé(s).`)
  }
}
