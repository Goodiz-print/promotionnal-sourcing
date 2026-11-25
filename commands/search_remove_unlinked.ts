import { inject } from '@adonisjs/core'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ProductIndexService from '#services/product_index_service'

/**
 * Retire de l'index de recherche les produits des fiches fournisseur non
 * rattachées à une organisation (#240) : `node ace search:remove-unlinked`.
 *
 * À lancer une fois au déploiement de la règle « seules les fiches rattachées
 * sont publiées » — ensuite, chaque rattachement ou détachement réindexe la
 * fiche (#231). Plus léger que `search:reindex` (aucun document recalculé) et
 * sûr à relancer : retirer un document absent est sans effet.
 */
export default class SearchRemoveUnlinked extends BaseCommand {
  static commandName = 'search:remove-unlinked'
  static description =
    "Retire de l'index de recherche les produits des fiches fournisseur non rattachées"

  static options: CommandOptions = {
    startApp: true,
  }

  @inject()
  async run(index: ProductIndexService) {
    if (!index.enabled) {
      this.logger.warning('MEILISEARCH_HOST est absent : renseignez-le, puis relancez.')
      return
    }

    this.logger.info("Retrait des produits non rattachés de l'index…")
    const removed = await index.removeUnlinkedProducts()
    this.logger.success(`${removed} produit(s) retiré(s) de l'index.`)
  }
}
