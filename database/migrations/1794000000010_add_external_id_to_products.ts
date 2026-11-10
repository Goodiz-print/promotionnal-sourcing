import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Identifiant du produit **chez le fournisseur** (code modèle PF Concept, SKU
 * parent Passot…), posé par les connecteurs de flux (`supplier:import`). Il rend
 * l'import idempotent : un second passage met à jour la fiche au lieu d'en créer
 * une nouvelle. `null` pour les fiches saisies à la main ; l'unicité ne porte
 * donc que sur les lignes renseignées (PostgreSQL ignore les `NULL`).
 */
export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('external_id', 100).nullable()
      table.unique(['supplier_id', 'external_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['supplier_id', 'external_id'])
      table.dropColumn('external_id')
    })
  }
}
