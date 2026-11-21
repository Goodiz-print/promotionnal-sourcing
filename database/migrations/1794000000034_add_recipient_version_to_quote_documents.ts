import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Version destinataire d'un devis PDF (#238).
 *
 * Un fournisseur non abonné ne connaît pas l'agence (#220) : la plateforme
 * appose le nom de l'agence et la référence de la demande sur une copie de son
 * PDF. `recipient_storage_object_id` désigne cette copie, celle que l'agence
 * reçoit ; le fichier d'origine reste celui de la pièce jointe du message, le
 * seul que voit le fournisseur. `stamped_at` date l'apposition.
 *
 * Les deux restent vides pour un fournisseur abonné, ou quand le PDF n'a pas pu
 * être modifié (chiffré, signé, illisible) : l'agence reçoit alors l'original.
 * Pas de `ON DELETE` en cascade côté fichier : un objet stocké ne disparaît que
 * par `StorageService.release`.
 */
export default class extends BaseSchema {
  protected tableName = 'quote_documents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('recipient_storage_object_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('storage_objects')
      table.timestamp('stamped_at').nullable()

      table.index(['recipient_storage_object_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['recipient_storage_object_id'])
      table.dropForeign(['recipient_storage_object_id'])
      table.dropColumn('recipient_storage_object_id')
      table.dropColumn('stamped_at')
    })
  }
}
