import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Lot de panier (#229) : `rfqs.batch_id` relie les demandes créées par une
 * même validation du panier (une demande par fournisseur). `null` pour une
 * demande créée seule. Indexé : « Mes demandes » (#228) regroupe par lot.
 */
export default class extends BaseSchema {
  protected tableName = 'rfqs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('batch_id').nullable().index()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['batch_id'])
      table.dropColumn('batch_id')
    })
  }
}
