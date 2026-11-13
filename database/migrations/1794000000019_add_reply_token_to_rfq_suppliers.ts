import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Jeton de l'adresse relais d'un couple demande / fournisseur (#223) :
 * `rfq-<jeton>@<domaine relais>`, posée en `Reply-To` sur les mails de demande.
 *
 * Aléatoire (UUID v4, 122 bits) et non devinable ; généré **par la base** pour
 * que toute ligne en ait un, quelle que soit la façon dont elle est insérée —
 * le défaut volatil remplit aussi les lignes existantes, chacune avec sa valeur.
 */
export default class extends BaseSchema {
  protected tableName = 'rfq_suppliers'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .string('reply_token', 32)
        .notNullable()
        .defaultTo(this.raw("replace(gen_random_uuid()::text, '-', '')"))
      table.unique(['reply_token'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['reply_token'])
      table.dropColumn('reply_token')
    })
  }
}
