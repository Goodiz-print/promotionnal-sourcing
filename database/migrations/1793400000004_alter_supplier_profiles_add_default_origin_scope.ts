import { BaseSchema } from '@adonisjs/lucid/schema'
import { DEFAULT_ORIGIN_SCOPES } from '#shared/types/organization'

/**
 * Provenance par défaut déclarée par le fournisseur (écart 9), appliquée à son
 * catalogue à défaut d'origine saisie par produit.
 */
export default class extends BaseSchema {
  protected tableName = 'supplier_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('default_origin_scope', [...DEFAULT_ORIGIN_SCOPES]).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('default_origin_scope')
    })
  }
}
