import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Cloudinary est remplacé par Cellar (on repart de zéro, pas de reprise des
 * assets existants) : les références `public_id` Cloudinary cèdent la place à
 * une clé étrangère vers `storage_objects`.
 *
 * - `product_images.public_id` (unique) disparaît : deux produits peuvent
 *   désormais partager le même objet (dédoublonnage par checksum).
 * - `ON DELETE RESTRICT` : on ne supprime jamais une ligne `storage_objects`
 *   encore référencée — le garde-fou contre un fichier cassé.
 * - La colonne reste nullable : les lignes antérieures (URL Cloudinary
 *   historique) n'ont pas d'objet Cellar.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('product_images', (table) => {
      table.dropColumn('public_id')
      table
        .integer('storage_object_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('storage_objects')
        .onDelete('RESTRICT')
      table.index('storage_object_id')
    })

    this.schema.alterTable('organizations', (table) => {
      table.dropColumn('logo_public_id')
      table
        .integer('logo_storage_object_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('storage_objects')
        .onDelete('RESTRICT')
      table.index('logo_storage_object_id')
    })
  }

  async down() {
    this.schema.alterTable('organizations', (table) => {
      table.dropColumn('logo_storage_object_id')
      table.string('logo_public_id', 255).nullable()
    })

    // `public_id` était `NOT NULL UNIQUE` : les lignes existantes n'ont plus
    // d'identifiant Cloudinary, on les rétablit donc avec une valeur dérivée
    // de l'id (unique) avant de reposer la contrainte.
    this.schema.alterTable('product_images', (table) => {
      table.dropColumn('storage_object_id')
      table.string('public_id', 255).nullable()
    })
    this.schema.raw(`UPDATE product_images SET public_id = 'legacy-' || id`)
    this.schema.alterTable('product_images', (table) => {
      table.string('public_id', 255).notNullable().alter()
      table.unique(['public_id'])
    })
  }
}
