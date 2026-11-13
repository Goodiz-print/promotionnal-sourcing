import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { InboundMailSchema } from '#database/schema'
import InboundMailAttachment from '#models/inbound_mail_attachment'
import RfqSupplier from '#models/rfq_supplier'
import type { InboundMailRejection, InboundMailStatus } from '#shared/types/inbound_mail'

/**
 * Mail entrant journalisé (#223) : la réponse d'un fournisseur à l'adresse
 * relais d'une demande de devis, ou un mail écarté par un garde-fou.
 */
export default class InboundMail extends InboundMailSchema {
  static table = 'inbound_mails'

  declare status: InboundMailStatus
  declare rejectionReason: InboundMailRejection | null
  declare headers: Record<string, string> | null

  /**
   * Corps HTML **tel que reçu**, jamais assaini : il vient d'un tiers. À ne
   * jamais rendre tel quel (`v-html`) — l'assainir à l'affichage, ou afficher
   * `textBody` (cf. `docs/mail.md`).
   */
  declare htmlBody: string | null

  @belongsTo(() => RfqSupplier)
  declare rfqSupplier: BelongsTo<typeof RfqSupplier>

  @hasMany(() => InboundMailAttachment)
  declare attachments: HasMany<typeof InboundMailAttachment>
}
