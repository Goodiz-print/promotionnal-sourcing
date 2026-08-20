import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Archivage réversible d'une organisation : `archived_at` non nul = organisation
 * hors service (exclue du catalogue public, plus accessible à ses membres, qui
 * basculent sur une autre adhésion ou repartent sur l'onboarding). Aucune
 * suppression physique — `suppliers.organization_id` étant en `SET NULL`, un
 * DELETE laisserait des fiches et des produits orphelins encore publiés.
 *
 * La restauration se fait en base (`archived_at` remis à NULL), aucun écran ne
 * l'expose.
 */
export default class extends BaseSchema {
  protected tableName = 'organizations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('archived_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('archived_at')
    })
  }
}
