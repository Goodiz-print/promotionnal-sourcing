import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import QuoteService from '#services/quote_service'
import StorageService from '#services/storage/storage_service'
import { attachmentDisposition } from '#shared/helpers/http'
import { RfqNotClosableException } from '#exceptions/rfq_errors'

/**
 * Téléchargement d'un devis PDF reçu par mail (#225), lien des mails transmis à
 * l'agence (et de l'écran de la demande, #228). Réservé aux membres de l'agence
 * propriétaire de la demande (ability `canDownloadQuoteDocument`) : un tiers
 * reçoit un 403, un devis inconnu un 404.
 *
 * Sert `QuoteDocument#recipientFile` : la version au nom de l'agence pour un
 * fournisseur non abonné (#238), sinon l'original. Le fichier transite par
 * l'application : son URL de stockage n'est jamais donnée.
 *
 * « Retenir » un devis PDF (#228) clôture la demande, sans créer de commande :
 * décision réservée aux responsables (ability `canSelectQuoteDocument`).
 */
@inject()
export default class QuoteDocumentsController {
  constructor(
    private quotes: QuoteService,
    private storage: StorageService
  ) {}

  async download({ bouncer, params, response }: HttpContext) {
    const document = await this.quotes.findDocument(Number(params.id))
    await bouncer.authorize('canDownloadQuoteDocument', document)

    const file = document.recipientFile
    response
      .header('Content-Type', file.mimeType)
      .header('Content-Disposition', attachmentDisposition(document.attachment.filename))
      .header('Cache-Control', 'private, no-store')
      // Contenu fourni par un tiers : le navigateur s'en tient au type déclaré.
      .header('X-Content-Type-Options', 'nosniff')
    return response.send(await this.storage.read(file))
  }

  /**
   * Marque le devis « retenu » et clôture la demande. Une demande qui n'est
   * plus ouverte (déjà close, échue, brouillon) devient un message flash, pas
   * une page d'erreur ; dans tous les cas, retour à l'écran de la demande.
   */
  async select({ bouncer, i18n, params, response, session }: HttpContext) {
    const document = await this.quotes.findDocumentForDecision(Number(params.id))
    await bouncer.authorize('canSelectQuoteDocument', document)

    try {
      await this.quotes.selectDocument(document)
      session.flash('success', i18n.t('quote.documents.flash.selected'))
    } catch (error) {
      if (!(error instanceof RfqNotClosableException)) throw error
      session.flash('error', i18n.t('quote.documents.errors.notSelectable'))
    }
    return response.redirect().back()
  }
}
