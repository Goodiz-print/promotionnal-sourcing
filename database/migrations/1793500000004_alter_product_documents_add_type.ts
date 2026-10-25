import { BaseSchema } from '@adonisjs/lucid/schema'
import { PRODUCT_DOCUMENT_TYPES } from '#shared/types/document'

/**
 * Nature d'une fiche PDF produit (écart 4) : fiche technique / sécurité /
 * certificat / gabarit de marquage (écart 2) / autre. Défaut `spec_sheet` : les
 * fiches existantes restent des fiches techniques.
 */
export default class extends BaseSchema {
  protected tableName = 'product_documents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum('type', [...PRODUCT_DOCUMENT_TYPES])
        .notNullable()
        .defaultTo(PRODUCT_DOCUMENT_TYPES[0])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('type')
    })
  }
}
