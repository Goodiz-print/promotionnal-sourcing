import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Motifs pour lesquels une inscription n'a pas été activée automatiquement
 * (TVA non vérifiée, email grand public, domaine différent du site…). Vide :
 * le compte était actif dès l'inscription.
 */
export default class extends BaseSchema {
  protected tableName = 'organizations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.specificType('review_reasons', 'text[]').notNullable().defaultTo('{}')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('review_reasons')
    })
  }
}
