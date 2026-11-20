import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Rattachement d'une fiche fournisseur importée à l'organisation du fournisseur
 * (#231). Le rattachement, validé par un admin, vaut accord du fournisseur pour
 * publier son catalogue : on en garde la date et l'auteur.
 *
 * - `linked_at` : date du rattachement (null pour une fiche non rattachée, ou
 *   rattachée avant cette migration — seeders, fiche créée par le fournisseur) ;
 * - `linked_by_user_id` : admin qui l'a validé ; `SET NULL` si son compte est
 *   supprimé (le journal d'audit garde l'email).
 *
 * L'index partiel sert la file « en attente d'accord » du back-office.
 */
export default class extends BaseSchema {
  protected tableName = 'suppliers'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('linked_at').nullable()
      table
        .integer('linked_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
    })
    this.schema.raw(
      'CREATE INDEX suppliers_unlinked_index ON suppliers (id) WHERE organization_id IS NULL'
    )
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS suppliers_unlinked_index')
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['linked_by_user_id'])
      table.dropColumn('linked_by_user_id')
      table.dropColumn('linked_at')
    })
  }
}
