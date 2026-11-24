import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { InvalidDocumentException } from '#exceptions/document_errors'
import { ConversationBlockedException } from '#exceptions/messaging_errors'
import { RfqSupplierNotReplyableException } from '#exceptions/rfq_errors'
import OrganizationContextService from '#services/organization_context_service'
import QuoteService from '#services/quote_service'
import RfqThreadService from '#services/rfq_thread_service'
import StorageService from '#services/storage/storage_service'
import SupplierReplyService from '#services/supplier_reply_service'
import { attachmentDisposition } from '#shared/helpers/http'
import { supplierQuoteDocumentValidator } from '#validators/supplier_quote_document'

/**
 * Devis PDF du fournisseur sur une demande reçue (#230).
 *
 * - **Dépôt** depuis l'écran, en alternative à la réponse par mail : même
 *   traitement qu'un PDF reçu par mail (`SupplierReplyService#recordUpload`).
 *   Une demande qui ne lui est pas adressée est un 404 ; l'autorisation est
 *   `canUploadRfqQuoteDocument`.
 * - **Téléchargement** d'un devis envoyé, réservé au fournisseur destinataire
 *   (`canDownloadSentQuoteDocument`) : toujours le fichier **d'origine**, jamais
 *   la copie au nom de l'agence (#238) qui n'est servie qu'à l'agence
 *   (`QuoteDocumentsController`). Le fichier transite par l'application.
 */
@inject()
export default class SupplierQuoteDocumentsController {
  constructor(
    private replies: SupplierReplyService,
    private threads: RfqThreadService,
    private quotes: QuoteService,
    private storage: StorageService,
    private organizations: OrganizationContextService
  ) {}

  /**
   * Un refus attendu (fichier qui n'est pas un PDF, fil bloqué par la
   * plateforme, demande déclinée entre-temps) devient une erreur du champ
   * `file`, comme une erreur de validation : le formulaire garde sa saisie.
   * Dans tous les cas, retour à l'écran de la demande.
   */
  async store({ auth, bouncer, request, response, params, session, i18n }: HttpContext) {
    const user = auth.getUserOrFail()
    const org = await this.organizations.currentFor(user)
    const recipient = await this.threads.recipientForSupplier(Number(params.id), org.id)
    await bouncer.authorize('canUploadRfqQuoteDocument', recipient.rfq, recipient)

    const { file, body } = await request.validateUsing(supplierQuoteDocumentValidator)
    try {
      await this.replies.recordUpload(recipient, user, {
        tmpPath: file.tmpPath!,
        filename: file.clientName,
        body: body ?? '',
      })
      session.flash('success', i18n.t('quote.supplier.documents.flash.uploaded'))
    } catch (error) {
      session.flashErrors({ file: i18n.t(this.uploadErrorKey(error)) })
    }
    return response.redirect().back()
  }

  async download({ bouncer, params, response }: HttpContext) {
    const document = await this.quotes.findDocumentForSupplier(Number(params.id))
    await bouncer.authorize('canDownloadSentQuoteDocument', document)

    const file = document.attachment.storageObject
    response
      .header('Content-Type', file.mimeType)
      .header('Content-Disposition', attachmentDisposition(document.attachment.filename))
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
    return response.send(await this.storage.read(file))
  }

  /**
   * Clé du message d'un refus attendu ; toute autre erreur remonte. Reste ici :
   * c'est la traduction d'exceptions en réponse HTTP, pas un calcul métier.
   */
  private uploadErrorKey(error: unknown): string {
    if (error instanceof InvalidDocumentException) return 'quote.supplier.documents.errors.notPdf'
    if (error instanceof ConversationBlockedException) return 'messaging.errors.blocked'
    if (error instanceof RfqSupplierNotReplyableException) {
      return 'quote.supplier.documents.errors.notReplyable'
    }
    throw error
  }
}
