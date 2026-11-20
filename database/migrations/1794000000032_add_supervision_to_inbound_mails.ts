import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Supervision des mails entrants (#227).
 *
 * - `attached_manually_at` : un admin a rattaché le mail à un couple demande /
 *   fournisseur (`rfq_supplier_id`). Le traitement suit alors ce rattachement
 *   au lieu de l'adresse relais, et ne l'écarte plus pour adresse inconnue,
 *   expirée ou réponse automatique (l'auteur est tracé dans le journal d'audit).
 * - `failure_alerted_at` : l'alerte « échecs répétés » est partie pour ce mail ;
 *   la reprise planifiée qui le rejoue ne la renvoie pas.
 */
export default class extends BaseSchema {
  protected tableName = 'inbound_mails'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('attached_manually_at').nullable()
      table.timestamp('failure_alerted_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('attached_manually_at')
      table.dropColumn('failure_alerted_at')
    })
  }
}
