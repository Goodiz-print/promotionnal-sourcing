import { mailIdempotencyKey } from '#shared/helpers/mail'
import { MAIL_KINDS, type SendMailPayload } from '#shared/types/mail'
import type { SupplierReplyMailInput } from '#shared/types/supplier_reply'

/**
 * Charge du mail qui transmet la réponse d'un fournisseur à `user` (#225). La
 * clé d'idempotence porte le message du fil et le destinataire : un événement
 * rejoué n'envoie rien de plus. Un devis sans chemin n'est pas cité.
 */
export function supplierReplyMail({
  notice,
  user,
  paths,
}: SupplierReplyMailInput): SendMailPayload {
  return {
    kind: MAIL_KINDS.supplierReplyReceived,
    idempotencyKey: mailIdempotencyKey(MAIL_KINDS.supplierReplyReceived, {
      message: notice.messageId,
      to: user.email,
    }),
    to: user.email,
    locale: user.locale,
    data: {
      supplierName: notice.supplierName,
      rfqTitle: notice.rfqTitle,
      body: notice.body,
      documents: notice.documents
        .filter(({ id }) => paths.documentPaths[id] !== undefined)
        .map(({ id, filename }) => ({ filename, downloadPath: paths.documentPaths[id] })),
      rfqPath: paths.rfqPath,
      replyTo: notice.replyTo,
    },
  }
}
