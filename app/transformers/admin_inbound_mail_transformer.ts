import { BaseTransformer } from '@adonisjs/core/transformers'
import type InboundMail from '#models/inbound_mail'
import type InboundMailAttachment from '#models/inbound_mail_attachment'
import type RfqSupplier from '#models/rfq_supplier'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { Paginated } from '#shared/types/pagination'
import {
  INBOUND_MAIL_ATTACHABLE_STATUSES,
  INBOUND_MAIL_DISMISSABLE_STATUSES,
  INBOUND_MAIL_ERROR_MAX_LENGTH,
  INBOUND_MAIL_ERROR_SUMMARY_LENGTH,
  INBOUND_MAIL_REPLAYABLE_STATUSES,
  type AdminInboundMailActions,
  type AdminInboundMailAttachment,
  type AdminInboundMailDetail,
  type AdminInboundMailRecipient,
  type AdminInboundMailRow,
} from '#shared/types/admin_inbound_mail'
import type { InboundMailStatus } from '#shared/types/inbound_mail'

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max)}…` : value

/** Actions possibles sur un mail, selon son état (cf. `INBOUND_MAIL_*_STATUSES`). */
export function inboundMailActions(status: InboundMailStatus): AdminInboundMailActions {
  return {
    attachable: INBOUND_MAIL_ATTACHABLE_STATUSES.includes(status),
    replayable: INBOUND_MAIL_REPLAYABLE_STATUSES.includes(status),
    dismissable: INBOUND_MAIL_DISMISSABLE_STATUSES.includes(status),
  }
}

/** Couple demande / fournisseur, `rfq` et `supplierOrganization` préchargés. */
export function inboundMailRecipient(recipient: RfqSupplier): AdminInboundMailRecipient {
  return {
    rfqSupplierId: recipient.id,
    rfqId: recipient.rfqId,
    rfqTitle: recipient.rfq.title,
    supplierName: recipient.supplierOrganization.name,
    status: recipient.status,
    sentAt: recipient.sentAt?.toISO() ?? null,
  }
}

/** Ligne de la supervision des mails entrants (#227), `rfqSupplier` préchargé. */
export default class AdminInboundMailTransformer extends BaseTransformer<InboundMail> {
  toObject(): AdminInboundMailRow {
    const mail = this.resource
    return {
      ...this.pick(mail, [
        'id',
        'senderAddress',
        'senderName',
        'recipient',
        'subject',
        'status',
        'rejectionReason',
      ]),
      ...inboundMailActions(mail.status),
      error: mail.error
        ? truncate(mail.error.split('\n')[0], INBOUND_MAIL_ERROR_SUMMARY_LENGTH)
        : null,
      attachedManually: mail.attachedManuallyAt !== null,
      target: mail.rfqSupplier ? inboundMailRecipient(mail.rfqSupplier) : null,
      receivedAt: mail.receivedAt.toISO()!,
      processedAt: mail.processedAt?.toISO() ?? null,
    }
  }

  /** Fiche : `attachments` préchargées en plus. */
  toDetail(): AdminInboundMailDetail {
    const mail = this.resource
    return {
      ...this.toObject(),
      ...this.pick(mail, ['provider', 'messageId', 'senderKnown', 'sizeBytes', 'textBody']),
      fullError: mail.error ? truncate(mail.error, INBOUND_MAIL_ERROR_MAX_LENGTH) : null,
      attachedManuallyAt: mail.attachedManuallyAt?.toISO() ?? null,
      attachments: mail.attachments.map((attachment) => this.attachment(attachment)),
    }
  }

  private attachment(attachment: InboundMailAttachment): AdminInboundMailAttachment {
    return this.pick(attachment, ['id', 'filename', 'mimeType', 'sizeBytes', 'status'])
  }
}

/** Page de la liste, au format `Paginated` des écrans admin. */
export function inboundMailPage(
  paginator: ModelPaginatorContract<InboundMail>
): Paginated<AdminInboundMailRow> {
  const { meta } = paginator.toJSON()
  return {
    data: paginator.all().map((mail) => new AdminInboundMailTransformer(mail).toObject()),
    meta: {
      total: meta.total,
      perPage: meta.perPage,
      currentPage: meta.currentPage,
      lastPage: meta.lastPage,
    },
  }
}
