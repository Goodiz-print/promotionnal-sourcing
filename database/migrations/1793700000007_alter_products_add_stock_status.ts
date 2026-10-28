import { BaseSchema } from '@adonisjs/lucid/schema'
import { PRODUCT_STOCK_STATUSES } from '#shared/types/product'

/**
 * Statut de stock **agrégé** au niveau produit (plan L98) :
 *
 * - `stock_status` : colonne **dérivée** (jamais saisie), agrégée depuis les
 *   variantes actives par `ProductStockService` avec la sémantique « priorité
 *   au disponible », maintenue au save produit et au backfill de
 *   `ProductIndexService`. `null` = aucune variante active ne porte de statut
 *   (exclu de la facette). Alimente la facette Meilisearch `stockStatus`.
 *
 * Même convention d'enum que `lifecycle_status` / `origin_zone`.
 */
export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('stock_status', [...PRODUCT_STOCK_STATUSES]).nullable()
      table.index(['stock_status'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['stock_status'])
      table.dropColumn('stock_status')
    })
  }
}
