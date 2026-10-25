import { BaseSchema } from '@adonisjs/lucid/schema'
import { PRODUCT_IMAGE_ROLES } from '#shared/types/product'

/**
 * Rôle d'une image de la galerie (écart 8) : principale, vue produit, mise en
 * situation, visuel marqué. Nullable : une image non typée reste valide.
 */
export default class extends BaseSchema {
  protected tableName = 'product_images'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('role', [...PRODUCT_IMAGE_ROLES]).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('role')
    })
  }
}
