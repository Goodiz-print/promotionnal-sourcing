import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Options d'une ligne du panier de devis : variante (couleur/taille) et
 * marquage (position + technique, nombre de couleurs). Servent à estimer le
 * prix via les grilles dégressives et sont transmises au fournisseur dans les
 * `specs` de la ligne de demande (cf. `QuoteCartService`).
 *
 * L'unicité passe de (utilisateur, organisation, produit) à
 * (utilisateur, organisation, produit, variante) : on peut demander deux
 * couleurs du même produit.
 */
export default class extends BaseSchema {
  protected tableName = 'quote_cart_items'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // `SET NULL` : une variante ou une technique retirée du catalogue laisse
      // la ligne au panier, sans l'option (l'acheteur la rechoisira).
      table
        .integer('variant_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('product_variants')
        .onDelete('SET NULL')
      table
        .integer('marking_position_technique_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('product_marking_position_techniques')
        .onDelete('SET NULL')
      table.smallint('marking_colors').unsigned().nullable()

      table.dropUnique(['user_id', 'organization_id', 'product_id'])
    })

    // `NULLS NOT DISTINCT` (PG ≥ 15) : deux lignes sans variante du même
    // produit restent un doublon.
    this.schema.raw(
      `CREATE UNIQUE INDEX quote_cart_items_line_unique_idx
         ON ${this.tableName} (user_id, organization_id, product_id, variant_id) NULLS NOT DISTINCT`
    )
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS quote_cart_items_line_unique_idx')
    // L'ancienne unicité ne tolère qu'une ligne par produit : on garde la plus
    // ancienne, les autres variantes sont perdues au rollback.
    this.schema.raw(
      `DELETE FROM ${this.tableName} a
         USING ${this.tableName} b
        WHERE a.user_id = b.user_id
          AND a.organization_id = b.organization_id
          AND a.product_id = b.product_id
          AND a.id > b.id`
    )
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('marking_colors')
      table.dropColumn('marking_position_technique_id')
      table.dropColumn('variant_id')
      table.unique(['user_id', 'organization_id', 'product_id'])
    })
  }
}
