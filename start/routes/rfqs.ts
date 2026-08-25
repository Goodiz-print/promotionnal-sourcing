import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

/**
 * Demandes de devis (RFQ) : les deux côtés du domaine, acheteur et fournisseur.
 *
 * Appelé depuis `start/routes.ts`, **à l'intérieur** du groupe préfixé par la
 * locale et gardé par `auth` + `onboarded` : ces routes supposent un
 * utilisateur connecté disposant d'une organisation courante.
 *
 * Premier domaine extrait dans `start/routes/`, comme le prévoit CLAUDE.md ;
 * le reste du fichier de routes suivra.
 */
export function registerRfqRoutes(): void {
  router.get('rfqs', [controllers.Rfqs, 'index']).as('rfqs.index')
  router.get('rfqs/new', [controllers.Rfqs, 'create']).as('rfqs.create')
  router.post('rfqs', [controllers.Rfqs, 'store']).as('rfqs.store')
  router.get('rfqs/:id', [controllers.Rfqs, 'show']).as('rfqs.show')
  router.patch('rfqs/:id', [controllers.Rfqs, 'update']).as('rfqs.update')

  // Destinataires : ajout (brouillon ou élargissement d'une demande publiée)
  // et retrait tant qu'ils n'ont pas été notifiés.
  router.post('rfqs/:id/suppliers', [controllers.Rfqs, 'addSuppliers']).as('rfqs.suppliers.store')
  router
    .delete('rfqs/:id/suppliers/:supplierId', [controllers.Rfqs, 'removeSupplier'])
    .as('rfqs.suppliers.destroy')

  // Transitions : publier fige le besoin, envoyer notifie les destinataires en
  // attente, clôturer arrête la consultation (cf. `RfqService`).
  router.post('rfqs/:id/publish', [controllers.Rfqs, 'publish']).as('rfqs.publish')
  router.post('rfqs/:id/send', [controllers.Rfqs, 'send']).as('rfqs.send')
  router.post('rfqs/:id/close', [controllers.Rfqs, 'close']).as('rfqs.close')

  // Côté fournisseur : demandes reçues. Consulter le détail vaut accusé de
  // lecture (`sent` → `viewed`) ; décliner est la sortie explicite.
  router.get('supplier/rfqs', [controllers.supplier.Rfqs, 'index']).as('supplier.rfqs.index')
  router.get('supplier/rfqs/:id', [controllers.supplier.Rfqs, 'show']).as('supplier.rfqs.show')
  router
    .post('supplier/rfqs/:id/decline', [controllers.supplier.Rfqs, 'decline'])
    .as('supplier.rfqs.decline')
}
