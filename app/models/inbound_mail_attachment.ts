import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { InboundMailAttachmentSchema } from '#database/schema'
import StorageObject from '#models/storage_object'
import type { InboundAttachmentStatus } from '#shared/types/inbound_mail'

/**
 * Pièce jointe d'un mail entrant. Seules les pièces `stored` portent un fichier
 * (`storageObjectId`) ; les autres ne sont que journalisées.
 */
export default class InboundMailAttachment extends InboundMailAttachmentSchema {
  static table = 'inbound_mail_attachments'

  declare status: InboundAttachmentStatus

  @belongsTo(() => StorageObject, { foreignKey: 'storageObjectId' })
  declare storageObject: BelongsTo<typeof StorageObject>
}
