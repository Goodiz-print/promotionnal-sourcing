import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

/**
 * Devis (#5) : les deux côtés du domaine.
 *
 * Appelé depuis `start/routes.ts`, **à l'intérieur** du groupe préfixé par la
 * locale et gardé par `auth` + `onboarded`, comme `registerRfqRoutes`.
 */
export function registerQuoteRoutes(): void {
  // Acheteur : consulter un devis remis, l'accepter ou le rejeter.
  router.get('quotes/:id', [controllers.Quotes, 'show']).as('quotes.show')
  router.patch('quotes/:id/accept', [controllers.Quotes, 'accept']).as('quotes.accept')
  router.patch('quotes/:id/reject', [controllers.Quotes, 'reject']).as('quotes.reject')

  // Agence : télécharger un devis PDF reçu par mail (#225), version au nom de
  // l'agence pour un fournisseur non abonné (#238). Lien des mails transmis.
  router
    .get('quote-documents/:id/download', [controllers.QuoteDocuments, 'download'])
    .where('id', router.matchers.number())
    .as('quote_documents.download')

  // Fournisseur : rédiger, remettre.
  router.get('supplier/quotes', [controllers.supplier.Quotes, 'index']).as('supplier.quotes.index')
  router
    .get('supplier/rfqs/:rfqId/quotes/new', [controllers.supplier.Quotes, 'create'])
    .as('supplier.quotes.create')
  router
    .post('supplier/rfqs/:rfqId/quotes', [controllers.supplier.Quotes, 'store'])
    .as('supplier.quotes.store')
  router
    .get('supplier/quotes/:id', [controllers.supplier.Quotes, 'show'])
    .as('supplier.quotes.show')
  router
    .patch('supplier/quotes/:id', [controllers.supplier.Quotes, 'update'])
    .as('supplier.quotes.update')
  router
    .post('supplier/quotes/:id/submit', [controllers.supplier.Quotes, 'submit'])
    .as('supplier.quotes.submit')
  router
    .delete('supplier/quotes/:id', [controllers.supplier.Quotes, 'destroy'])
    .as('supplier.quotes.destroy')
}
