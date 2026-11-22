import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Côté qui a écrit un message (#226) : `agency` (l'organisation acheteuse du
 * fil) ou `supplier`. Un message né d'un mail n'a pas d'auteur ; le côté dit
 * dans quel sens il doit être relayé et comment l'afficher.
 *
 * Remplissage des lignes existantes : un message né d'un mail vient du
 * fournisseur (avant #226, seule l'adresse `rfq-` était reconnue) ; un message
 * écrit dans l'application vient de l'agence si son auteur est membre de
 * l'organisation acheteuse du fil, sinon du fournisseur. `messages` reste une
 * petite table : la mise à jour tient dans la transaction de la migration.
 */
export default class extends BaseSchema {
  protected tableName = 'messages'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('sender_side', 16).nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE messages AS m
        SET sender_side = CASE
          WHEN m.inbound_mail_id IS NULL AND EXISTS (
            SELECT 1
            FROM organization_users AS ou
            JOIN conversations AS c ON c.id = m.conversation_id
            WHERE ou.user_id = m.author_user_id
              AND ou.organization_id = c.buyer_organization_id
          ) THEN 'agency'
          ELSE 'supplier'
        END
      `)
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.string('sender_side', 16).notNullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('sender_side')
    })
  }
}
