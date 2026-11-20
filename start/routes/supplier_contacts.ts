import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

/**
 * Équipe commerciale du fournisseur (#241). Espace fournisseur : dans le groupe
 * `auth` + `emailVerified` + `onboarded`.
 */
export function registerSupplierContactRoutes(): void {
  router
    .get('supplier/contacts', [controllers.supplier.Contacts, 'index'])
    .as('supplier.contacts.index')
  router
    .post('supplier/contacts', [controllers.supplier.Contacts, 'store'])
    .as('supplier.contacts.store')
  // Avant `:id` : `settings` n'est pas un identifiant de contact.
  router
    .patch('supplier/contacts/settings', [controllers.supplier.Contacts, 'settings'])
    .as('supplier.contacts.settings')
  router
    .patch('supplier/contacts/:id', [controllers.supplier.Contacts, 'update'])
    .where('id', router.matchers.number())
    .as('supplier.contacts.update')
  router
    .delete('supplier/contacts/:id', [controllers.supplier.Contacts, 'destroy'])
    .where('id', router.matchers.number())
    .as('supplier.contacts.destroy')
  router
    .post('supplier/contacts/:id/move', [controllers.supplier.Contacts, 'move'])
    .where('id', router.matchers.number())
    .as('supplier.contacts.move')
}
