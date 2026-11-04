import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Langue source des techniques de marquage (#165). Comme `certifications`,
 * `categories` et `attributes`, la langue dans laquelle le libellé a été saisi
 * pilote la traduction automatique des autres langues. Les techniques existantes
 * (seeders) sont rédigées en français.
 */
export default class extends BaseSchema {
  protected tableName = 'marking_techniques'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('source_locale', 10).notNullable().defaultTo('fr')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('source_locale')
    })
  }
}
