import { BaseSchema } from '@adonisjs/lucid/schema'
import { DEFAULT_RFQ_STATUS, RFQ_STATUSES } from '#shared/types/rfq'

export default class extends BaseSchema {
  protected tableName = 'rfqs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('buyer_organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table.string('title', 180).notNullable()
      table.text('description').nullable()
      table
        .enum('status', [...RFQ_STATUSES])
        .notNullable()
        .defaultTo(DEFAULT_RFQ_STATUS)
      table.timestamp('deadline').nullable()
      table.decimal('budget_max', 12, 2).nullable()
      // L'auteur peut quitter l'organisation : la RFQ appartient à
      // l'organisation, pas à lui — on garde la demande sans son auteur.
      table
        .integer('created_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('published_at').nullable()
      table.timestamp('closed_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Écran « mes demandes » : filtré par organisation, souvent par statut.
      table.index(['buyer_organization_id', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
