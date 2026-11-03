import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Journal des recherches des clients (#171). `user_id` et `organization_id` sont
 * en `SET NULL` : le compte supprimé laisse une ligne anonyme, et la
 * pseudonymisation planifiée met `user_id` à `NULL` au-delà de 90 jours.
 */
export default class extends BaseSchema {
  protected tableName = 'search_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('source', 20).notNullable()
      table.string('query', 200).nullable()
      table.jsonb('filters').notNullable().defaultTo('{}')
      table.integer('category_id').unsigned().nullable()
      table.string('mode', 20).notNullable()
      table.integer('results_count').unsigned().notNullable()
      table.boolean('zero_results').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .integer('organization_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('organizations')
        .onDelete('SET NULL')
      table.string('locale', 5).notNullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())

      table.index(['created_at'])
      table.index(['source', 'created_at'])
      table.index(['zero_results', 'created_at'])
      table.index(['query', 'created_at'])
      table.index(['user_id', 'source', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
