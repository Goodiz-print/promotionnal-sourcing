import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Opérations de recherche lancées depuis le back-office (#176) : réindexation
 * (complète ou d'un fournisseur) et évaluation de pertinence. Une ligne par
 * demande : sert de suivi de progression pendant le traitement par la queue,
 * puis d'historique (rappel@10 d'une évaluation à l'autre). Ni clé étrangère ni
 * relation : l'historique survit à la suppression du fournisseur ou du compte.
 */
export default class extends BaseSchema {
  protected tableName = 'search_runs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('kind', 16).notNullable()
      table.string('status', 16).notNullable()
      table.integer('supplier_id').unsigned().nullable()
      table.string('supplier_name', 255).nullable()
      table.integer('processed').unsigned().notNullable().defaultTo(0)
      table.integer('total').unsigned().nullable()
      table.jsonb('result').nullable()
      table.text('error').nullable()
      table.integer('requested_by_id').unsigned().nullable()
      table.string('requested_by_email', 255).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('started_at').nullable()
      table.timestamp('finished_at').nullable()

      table.index(['kind', 'created_at'])
      table.index(['status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
