import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

/**
 * Consultations des produits et de la fiche fournisseur (#239). Espace
 * fournisseur : dans le groupe `auth` + `emailVerified` + `onboarded`.
 */
export function registerSupplierInsightsRoutes(): void {
  router
    .get('supplier/insights', [controllers.supplier.Insights, 'index'])
    .as('supplier.insights.index')
}
