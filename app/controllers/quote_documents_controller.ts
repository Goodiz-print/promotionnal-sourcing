import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import QuoteService from '#services/quote_service'
import StorageService from '#services/storage/storage_service'
import { attachmentDisposition } from '#shared/helpers/http'

/**
 * Téléchargement d'un devis PDF reçu par mail (#225), lien des mails transmis à
 * l'agence (et de l'écran de la demande, #228). Réservé aux membres de l'agence
 * propriétaire de la demande (ability `canDownloadQuoteDocument`) : un tiers
 * reçoit un 403, un devis inconnu un 404.
 *
 * Sert `QuoteDocument#recipientFile` : la version au nom de l'agence pour un
 * fournisseur non abonné (#238), sinon l'original. Le fichier transite par
 * l'application : son URL de stockage n'est jamais donnée.
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
    return response.send(await this.storage.read(file))
  }
}
