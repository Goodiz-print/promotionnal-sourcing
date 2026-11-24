import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Consultations d'un fournisseur (#239) : les compteurs partent des produits et
 * de la fiche du fournisseur (`target_type`, `target_id`) sur une période
 * (`created_at`). Sans cet index, une période d'un an parcourt par
 * `created_at` les événements de toute la plateforme à chaque affichage.
 * L'index `(target_type, target_id)` devient un préfixe du nouveau : il est
 * remplacé.
 */
export default class extends BaseSchema {
  protected tableName = 'activity_events'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['target_type', 'target_id', 'created_at'])
      table.dropIndex(['target_type', 'target_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['target_type', 'target_id'])
      table.dropIndex(['target_type', 'target_id', 'created_at'])
    })
  }
}
