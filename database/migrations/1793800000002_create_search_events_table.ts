import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Journal des recherches des clients (#171). Un événement par recherche
 * significative (terme et/ou filtres), écrit de façon asynchrone. `user_id` et
 * `organization_id` passent à `NULL` après la durée de pseudonymisation (RGPD) ;
 * la requête, elle, reste exploitable jusqu'à la purge. « Zéro résultat » se lit
 * dans `results_count = 0`.
 */
export default class extends BaseSchema {
  protected tableName = 'search_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('source', 20).notNullable()
      table.string('term', 255).nullable()
      table.jsonb('filters').notNullable().defaultTo('{}')
      table.integer('category_id').unsigned().nullable()
      table.string('mode', 20).notNullable()
      table.integer('results_count').unsigned().notNullable()
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
      table.index(['term'])
      table.index(['user_id'])
      table.index(['organization_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
