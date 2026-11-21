import { BaseSchema } from '@adonisjs/lucid/schema'
import { createIndexConcurrently } from '#database/concurrent_index'
import { dropIndexConcurrentlySql } from '#shared/helpers/database'

const INDEX = 'notifications_user_type_message_unique'

/**
 * Une notification au plus par utilisateur, type et message du fil (#225) :
 * la transmission d'une réponse fournisseur (`rfq.responded`) porte
 * `data.messageId`, et un événement rejoué — même en concurrence — ne doit pas
 * en créer une seconde (`NotificationService#notifyOncePerMessage` s'en sert
 * comme cible de `ON CONFLICT`). Index partiel : seules les notifications qui
 * portent un `messageId` sont concernées. Sert aussi la recherche des
 * déjà-notifiés.
 *
 * Construit `CONCURRENTLY` (`createIndexConcurrently`) : la table reste
 * ouverte en écriture, ce qui impose une migration hors transaction. Après un
 * échec, la migration se relance telle quelle.
 */
export default class extends BaseSchema {
  static disableTransactions = true

  protected tableName = 'notifications'

  async up() {
    this.defer((db) =>
      createIndexConcurrently(db, {
        name: INDEX,
        table: this.tableName,
        columns: `user_id, type, (data->>'messageId')`,
        where: `(data->>'messageId') IS NOT NULL`,
        unique: true,
      })
    )
  }

  async down() {
    this.schema.raw(dropIndexConcurrentlySql(INDEX))
  }
}
