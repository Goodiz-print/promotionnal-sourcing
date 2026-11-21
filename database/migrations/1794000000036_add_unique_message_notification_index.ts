import { BaseSchema } from '@adonisjs/lucid/schema'

const INDEX = 'notifications_user_type_message_unique'

/**
 * Une notification au plus par utilisateur, type et message du fil (#225) :
 * la transmission d'une réponse fournisseur (`rfq.responded`) porte
 * `data.messageId`, et un événement rejoué — même en concurrence — ne doit pas
 * en créer une seconde. Index partiel : seules les notifications qui portent un
 * `messageId` sont concernées. Sert aussi la recherche des déjà-notifiés.
 *
 * Construit `CONCURRENTLY` : la table reste ouverte en écriture pendant la
 * construction, ce qui impose une migration hors transaction. Un échec laisse
 * un index invalide : `down` le retire, puis on relance.
 */
export default class extends BaseSchema {
  static disableTransactions = true

  protected tableName = 'notifications'

  async up() {
    this.schema.raw(
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ${INDEX} ON ${this.tableName} (user_id, type, (data->>'messageId')) WHERE (data->>'messageId') IS NOT NULL`
    )
  }

  async down() {
    this.schema.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${INDEX}`)
  }
}
