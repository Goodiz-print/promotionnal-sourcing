import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_images'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      // URL sécurisée (https) renvoyée par Cloudinary.
      table.string('secure_url', 500).notNullable()
      // Identifiant Cloudinary, nécessaire pour supprimer l'asset.
      table.string('public_id', 255).notNullable().unique()
      // Ordre d'affichage dans la galerie (0 = image principale).
      table.integer('position').unsigned().notNullable().defaultTo(0)
      table.integer('width').unsigned().nullable()
      table.integer('height').unsigned().nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index('product_id')
      table.unique(['product_id', 'position'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
