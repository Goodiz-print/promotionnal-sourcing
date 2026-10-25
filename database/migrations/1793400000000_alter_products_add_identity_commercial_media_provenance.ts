import { BaseSchema } from '@adonisjs/lucid/schema'
import { ORIGIN_ZONES, PRODUCT_LIFECYCLE_STATUSES } from '#shared/types/product'

/**
 * Identité/classification (écart 5), commercial (écart 7), médias (écart 8) et
 * provenance dérivée (écart 9) au niveau produit.
 *
 * - `lifecycle_status` : les 4 états « Statut » du classeur ; `is_active` reste
 *   le simple on/off de publication ;
 * - `released_at` : alimente le filtre « Nouveautés » ;
 * - `origin_zone` : colonne **dérivée** (France/Europe/autre) calculée par
 *   `ProductOriginService` à partir de `origin_country`/`made_in_europe`, jamais
 *   saisie à la main (`null` = origine inconnue).
 */
export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Identité / classification (écart 5).
      table.string('brand', 255).nullable()
      table.string('hs_code', 20).nullable()
      table.boolean('is_configurable').notNullable().defaultTo(false)
      table
        .enum('lifecycle_status', [...PRODUCT_LIFECYCLE_STATUSES])
        .notNullable()
        .defaultTo(PRODUCT_LIFECYCLE_STATUSES[0])
      table.date('released_at').nullable()
      // Catégorie fournisseur brute (traçabilité de l'import).
      table.string('supplier_category_raw', 255).nullable()

      // Commercial (écart 7).
      table.integer('lead_time_days').unsigned().nullable()
      table.boolean('rush_service').notNullable().defaultTo(false)
      table.integer('rush_lead_time_days').unsigned().nullable()

      // Médias (écart 8).
      table.string('video_url', 2048).nullable()

      // Provenance dérivée (écart 9) — remplie par le pipeline d'indexation.
      table.enum('origin_zone', [...ORIGIN_ZONES]).nullable()
      table.index(['origin_zone'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['origin_zone'])
      table.dropColumns(
        'brand',
        'hs_code',
        'is_configurable',
        'lifecycle_status',
        'released_at',
        'supplier_category_raw',
        'lead_time_days',
        'rush_service',
        'rush_lead_time_days',
        'video_url',
        'origin_zone'
      )
    })
  }
}
