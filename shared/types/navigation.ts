/**
 * Routes nommées pouvant apparaître dans le menu applicatif. Le serveur ne
 * transmet que le nom de la route : le front résout l'URL avec la locale
 * courante (`urlFor`).
 */
export const NAVIGATION_ROUTES = [
  'dashboard.show',
  'products.index',
  'suppliers.index',
  'rfqs.index',
  'orders.index',
  'supplier.products.index',
  'supplier.rfqs.index',
  'supplier.quotes.index',
  'supplier.orders.index',
  'supplier.profile',
  'organization.members',
  'organization.settings',
  'admin.dashboard',
] as const

export type NavigationRoute = (typeof NAVIGATION_ROUTES)[number]

/**
 * Entrée du menu. Déclarée en `type` (et non `interface`) pour rester
 * assignable à `Record<string, JSONDataTypes>` — contrainte des props Inertia.
 * `labelKey` est une clé i18n `common.nav.*`.
 */
export type NavigationItemType = {
  key: string
  route: NavigationRoute
  labelKey: string
}
