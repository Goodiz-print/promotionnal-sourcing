import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Jeton de l'adresse relais **côté agence** d'un couple demande / fournisseur
 * (#225) : `agency-<jeton>@<domaine relais>`, posée en `Reply-To` du mail qui
 * transmet la réponse du fournisseur à l'agence.
 *
 * Distinct de `reply_token` : l'adresse côté fournisseur n'authentifie que par
 * son jeton, que l'agence ne doit donc jamais lire — elle pourrait sinon écrire
 * au nom du fournisseur dans le fil. Même génération par la base que
 * `reply_token` (UUID v4 sans tirets) ; le défaut volatil remplit aussi les
 * lignes existantes, chacune avec sa valeur.
 */
export default class extends BaseSchema {
  protected tableName = 'rfq_suppliers'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .string('agency_reply_token', 32)
        .notNullable()
        .defaultTo(this.raw("replace(gen_random_uuid()::text, '-', '')"))
      table.unique(['agency_reply_token'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['agency_reply_token'])
      table.dropColumn('agency_reply_token')
    })
  }
}
