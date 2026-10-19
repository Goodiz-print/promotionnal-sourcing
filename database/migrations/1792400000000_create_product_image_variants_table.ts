import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Variantes redimensionnées d'une image de galerie (carte, fiche, zoom),
 * générées par job à l'upload. Chaque variante est un objet `storage_objects` :
 * `ON DELETE RESTRICT` (jamais de fichier cassé), alors que la ligne part avec
 * son image (`CASCADE`) — le service libère alors les objets dans la même
 * transaction.
 */
export default class extends BaseSchema {
  protected tableName = 'product_image_variants'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('product_image_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('product_images')
        .onDelete('CASCADE')
      table.string('name', 20).notNullable()
      table
        .integer('storage_object_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('storage_objects')
        .onDelete('RESTRICT')
      table.string('url', 2048).notNullable()
      table.integer('width').unsigned().notNullable()
      table.integer('height').unsigned().notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['product_image_id', 'name'])
      table.index('storage_object_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
