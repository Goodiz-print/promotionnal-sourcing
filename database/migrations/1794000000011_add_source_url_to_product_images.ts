import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * URL **d'origine** d'une image de galerie importée d'un flux fournisseur
 * (`supplier:import`). Avec `--store-images`, `secure_url` pointe vers la copie
 * Cellar : sans l'URL source, un nouvel import ne peut ni reconnaître une image
 * déjà copiée (re-téléchargement systématique) ni distinguer un échec réseau
 * d'une image retirée. `null` pour les images téléversées à la main.
 */
export default class extends BaseSchema {
  protected tableName = 'product_images'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('source_url', 500).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('source_url')
    })
  }
}
