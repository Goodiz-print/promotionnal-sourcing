import type { NavigationItemType, NavigationRoute } from '#shared/types/navigation'
import type { OrganizationKind } from '#shared/types/organization'
import type { RoleSlug } from '#shared/types/role'

/**
 * Contexte de navigation : l'organisation courante de l'utilisateur et son rôle
 * dedans. `null` pour un visiteur ou un utilisateur sans organisation utilisable.
 */
export interface NavigationContext {
  organizationType: OrganizationKind
  roleSlug: RoleSlug
}

/** Rôles autorisés à gérer l'organisation (membres, paramètres). */
const MANAGEMENT_ROLES: readonly RoleSlug[] = ['owner', 'admin']

/**
 * Menu applicatif calculé côté serveur : le front n'a qu'à l'afficher. Ce n'est
 * jamais une autorisation — chaque route re-vérifie ses droits.
 */
export default class NavigationService {
  /**
   * `isPlatformAdmin` ajoute l'entrée « Administration » : elle dépend du rôle
   * plateforme, pas de l'organisation, donc elle vaut aussi sans contexte.
   */
  itemsFor(context: NavigationContext | null, isPlatformAdmin = false): NavigationItemType[] {
    const items: NavigationItemType[] = []
    const add = (key: string, route: NavigationRoute) =>
      items.push({ key, route, labelKey: `common.nav.${key}` })

    if (!context) {
      add('catalogue', 'products.index')
      add('suppliers', 'suppliers.index')
      if (isPlatformAdmin) add('admin', 'admin.dashboard')
      return items
    }

    const { organizationType, roleSlug } = context
    const isBuyer = organizationType === 'buyer' || organizationType === 'both'
    const isSupplier = organizationType === 'supplier' || organizationType === 'both'

    add('dashboard', 'dashboard.show')
    add('catalogue', 'products.index')
    add('suppliers', 'suppliers.index')

    if (isBuyer) add('rfqs', 'rfqs.index')
    if (isSupplier) {
      add('supplierProducts', 'supplier.products.index')
      add('supplierRfqs', 'supplier.rfqs.index')
      add('supplierProfile', 'supplier.profile')
    }
    if (MANAGEMENT_ROLES.includes(roleSlug)) {
      add('members', 'organization.members')
      add('settings', 'organization.settings')
    }
    if (isPlatformAdmin) add('admin', 'admin.dashboard')

    return items
  }
}
