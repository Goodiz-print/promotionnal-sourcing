import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

/**
 * Documents PDF fournisseurs (#60). Appelé depuis `start/routes.ts`, à l'intérieur
 * du groupe authentifié et `onboarded` : les contrôleurs vérifient les droits
 * (`canManageSupplierProfile` / `canManageProducts`).
 */
export function registerDocumentRoutes(): void {
  router
    .post('supplier/profile/documents', [controllers.supplier.Document, 'store'])
    .as('supplier.documents.store')
  router
    .delete('supplier/profile/documents/:id', [controllers.supplier.Document, 'destroy'])
    .as('supplier.documents.destroy')
  router
    .post('supplier/products/:id/documents', [controllers.supplier.ProductDocument, 'store'])
    .as('supplier.products.documents.store')
  router
    .delete('supplier/products/:id/documents/:documentId', [
      controllers.supplier.ProductDocument,
      'destroy',
    ])
    .as('supplier.products.documents.destroy')
}
