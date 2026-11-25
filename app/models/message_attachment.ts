import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { MessageAttachmentSchema } from '#database/schema'
import Message from '#models/message'
import StorageObject from '#models/storage_object'

/**
 * Pièce jointe d'un message (#224). Le fichier est sur Cellar
 * (`storageObjectId`, référencé dans `STORAGE_REFERENCES`).
 */
export default class MessageAttachment extends MessageAttachmentSchema {
  static table = 'message_attachments'

  @belongsTo(() => Message)
  declare message: BelongsTo<typeof Message>

  @belongsTo(() => StorageObject, { foreignKey: 'storageObjectId' })
  declare storageObject: BelongsTo<typeof StorageObject>
}
