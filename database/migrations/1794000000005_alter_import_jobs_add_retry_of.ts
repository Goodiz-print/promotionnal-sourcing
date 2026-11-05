import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Relance d'un import (#170) : on ne réécrit pas l'historique, la relance est un
 * nouvel import qui pointe vers celui qu'il remplace. Le lien empêche aussi de
 * relancer deux fois le même échec.
 */
export default class extends BaseSchema {
  protected tableName = 'import_jobs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('retry_of_import_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable(this.tableName)
        .onDelete('SET NULL')
      table.index(['retry_of_import_id'])
      table.index(['status', 'created_at'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['status', 'created_at'])
      table.dropIndex(['retry_of_import_id'])
      table.dropColumn('retry_of_import_id')
    })
  }
}
