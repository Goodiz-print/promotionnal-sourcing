import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Contenu de la page fournisseur publique : contacts commerciaux, actualités,
 * salons, spécialités (arbre de catégories). `supplier_news.image_storage_object_id`
 * figure dans `STORAGE_REFERENCES`.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('supplier_contacts', (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table.string('name', 255).notNullable()
      table.string('job_title', 255).nullable()
      table.string('email', 254).notNullable()
      table.string('phone', 30).nullable()
      table.specificType('languages', 'text[]').notNullable().defaultTo('{}')
      table.string('coverage', 255).nullable()
      table.integer('position').unsigned().notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['organization_id'])
    })

    this.schema.createTable('supplier_news', (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table.string('title', 255).notNullable()
      table.text('body').notNullable()
      table
        .integer('image_storage_object_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('storage_objects')
        .onDelete('SET NULL')
      table.timestamp('published_at').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['organization_id', 'published_at'])
    })

    this.schema.createTable('supplier_trade_shows', (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table.string('name', 255).notNullable()
      table.integer('year').unsigned().notNullable()
      table.string('booth', 50).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['organization_id'])
    })

    this.schema.createTable('organization_categories', (table) => {
      table
        .integer('organization_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      table
        .integer('category_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('categories')
        .onDelete('CASCADE')
      table.primary(['organization_id', 'category_id'])
    })
  }

  async down() {
    this.schema.dropTable('organization_categories')
    this.schema.dropTable('supplier_trade_shows')
    this.schema.dropTable('supplier_news')
    this.schema.dropTable('supplier_contacts')
  }
}
