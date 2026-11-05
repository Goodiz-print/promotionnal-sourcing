import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Journal des appels au fournisseur IA (#177) : volume, tokens, durée, échecs.
 * Alimenté par `TranslationService` (un enregistrement par appel Mistral, y
 * compris les appels rejetés). Les entités ne sont pas liées par clé étrangère :
 * le journal survit à leur suppression.
 */
export default class extends BaseSchema {
  protected tableName = 'ai_calls'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('service', 32).notNullable()
      table.string('model', 100).notNullable()
      table.string('entity', 32).nullable()
      table.integer('entity_id').unsigned().nullable()
      table.string('source_locale', 8).nullable()
      table.jsonb('target_locales').notNullable().defaultTo('[]')
      table.integer('prompt_tokens').unsigned().notNullable().defaultTo(0)
      table.integer('completion_tokens').unsigned().notNullable().defaultTo(0)
      table.integer('duration_ms').unsigned().notNullable().defaultTo(0)
      table.string('status', 16).notNullable()
      table.text('error').nullable()
      table.timestamp('created_at').notNullable()

      table.index(['created_at'])
      table.index(['status', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
