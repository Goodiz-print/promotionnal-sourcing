import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adresse de réception des demandes de devis confirmée (#217).
 *
 * `quote_email_verified_at` est posé quand le destinataire clique le lien reçu à
 * cette adresse, et remis à `null` à chaque changement d'adresse. Tant qu'il est
 * vide, les demandes partent à l'adresse de contact de l'organisation, à défaut
 * aux membres responsables. Les adresses saisies avant cette migration ne sont
 * pas confirmées : elles n'étaient jamais utilisées, rien ne change pour elles.
 */
export default class extends BaseSchema {
  protected tableName = 'supplier_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('quote_email_verified_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('quote_email_verified_at')
    })
  }
}
