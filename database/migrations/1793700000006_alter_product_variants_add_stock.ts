import { BaseSchema } from '@adonisjs/lucid/schema'
import { PRODUCT_STOCK_STATUSES } from '#shared/types/product'

/**
 * Stock par variante (plan L98) :
 *
 * - `stock_quantity` : quantité disponible, informative, nullable (`null` =
 *   inconnue) ;
 * - `stock_status` : statut de disponibilité (`in_stock`/`out_of_stock`/
 *   `on_order`), nullable (`null` = information inconnue). Même convention
 *   d'enum que `lifecycle_status` / `origin_zone` (`table.enum`).
 *
 * La facette de recherche agrège ces statuts au niveau produit
 * (`products.stock_status`, migration suivante).
 */
export default class extends BaseSchema {
  protected tableName = 'product_variants'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('stock_quantity').unsigned().nullable()
      table.enum('stock_status', [...PRODUCT_STOCK_STATUSES]).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumns('stock_quantity', 'stock_status')
    })
  }
}
