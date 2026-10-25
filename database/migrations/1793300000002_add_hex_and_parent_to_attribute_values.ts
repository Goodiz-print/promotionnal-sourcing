import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'attribute_values'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Pastille couleur a l'ecran (#RRGGBB). Facultatif : seules les valeurs
      // de couleur le portent.
      table.specificType('hex', 'char(7)').nullable()
      // Couleur a 2 niveaux : une nuance (N2) pointe vers sa famille (N1), elle
      // aussi une attribute_value (d'un autre attribut). SET NULL : retirer une
      // famille ne supprime pas ses nuances, elles perdent juste le rattachement.
      table
        .integer('parent_value_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('attribute_values')
        .onDelete('SET NULL')
      table.index(['parent_value_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['parent_value_id'])
      table.dropIndex(['parent_value_id'])
      table.dropColumn('parent_value_id')
      table.dropColumn('hex')
    })
  }
}
