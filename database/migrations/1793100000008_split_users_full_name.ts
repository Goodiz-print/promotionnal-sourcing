import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Sépare `users.full_name` en `first_name` / `last_name` (formulaires d'inscription
 * agence et fournisseur). Reprise des données existantes : le premier mot devient
 * le prénom, le reste le nom (un nom d'un seul mot n'a donc pas de nom de famille).
 * L'ancien nom complet reste disponible via le getter `User#fullName`.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('first_name', 100).nullable()
      table.string('last_name', 100).nullable()
    })

    this.schema.raw(`
      UPDATE users
      SET first_name = NULLIF(left(split_part(btrim(full_name), ' ', 1), 100), ''),
          last_name = NULLIF(left(btrim(substr(btrim(full_name), length(split_part(btrim(full_name), ' ', 1)) + 1)), 100), '')
      WHERE full_name IS NOT NULL
    `)

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('full_name')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('full_name').nullable()
    })

    this.schema.raw(`
      UPDATE users
      SET full_name = NULLIF(btrim(concat_ws(' ', first_name, last_name)), '')
    `)

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('last_name')
      table.dropColumn('first_name')
    })
  }
}
