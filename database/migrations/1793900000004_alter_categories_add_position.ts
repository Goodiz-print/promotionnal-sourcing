import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ordre d'affichage des catégories (#165). `position` classe les catégories
 * **parmi leurs sœurs** (même `parent_id`). Les catégories existantes gardent
 * leur ordre actuel (alphabétique par slug) grâce à un renseignement initial.
 */
export default class extends BaseSchema {
  protected tableName = 'categories'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('position').notNullable().defaultTo(0)
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE categories
        SET position = ranked.position
        FROM (
          SELECT id, (ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY slug) - 1) AS position
          FROM categories
        ) AS ranked
        WHERE categories.id = ranked.id
      `)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('position')
    })
  }
}
