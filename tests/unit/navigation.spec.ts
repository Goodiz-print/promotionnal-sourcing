import { test } from '@japa/runner'
import NavigationService from '#services/navigation_service'
import { isActivePath } from '#shared/helpers/navigation'
import type { OrganizationKind } from '#shared/types/organization'
import type { RoleSlug } from '#shared/types/role'

const service = new NavigationService()

function routesFor(organizationType: OrganizationKind, roleSlug: RoleSlug): string[] {
  return service.itemsFor({ organizationType, roleSlug }).map((item) => item.route)
}

test.group('NavigationService', () => {
  test('un visiteur ne voit que le catalogue et les fournisseurs', ({ assert }) => {
    const routes = service.itemsFor(null).map((item) => item.route)

    assert.deepEqual(routes, ['products.index', 'suppliers.index'])
  })

  test('un acheteur membre voit ses demandes mais pas les écrans fournisseur ni la gestion', ({
    assert,
  }) => {
    const routes = routesFor('buyer', 'member')

    assert.includeMembers(routes, ['dashboard.show', 'products.index', 'rfqs.index'])
    assert.notIncludeMembers(routes, [
      'supplier.products.index',
      'supplier.rfqs.index',
      'supplier.profile',
      'organization.members',
      'organization.settings',
    ])
  })

  test('un fournisseur voit ses écrans fournisseur mais pas « Mes demandes de devis »', ({
    assert,
  }) => {
    const routes = routesFor('supplier', 'member')

    assert.includeMembers(routes, [
      'supplier.products.index',
      'supplier.rfqs.index',
      'supplier.profile',
    ])
    assert.notInclude(routes, 'rfqs.index')
  })

  test('une organisation « both » cumule les entrées acheteur et fournisseur', ({ assert }) => {
    assert.includeMembers(routesFor('both', 'member'), ['rfqs.index', 'supplier.rfqs.index'])
  })

  for (const roleSlug of ['owner', 'admin'] as const) {
    test(`le rôle ${roleSlug} accède aux membres et aux paramètres`, ({ assert }) => {
      assert.includeMembers(routesFor('buyer', roleSlug), [
        'organization.members',
        'organization.settings',
      ])
    })
  }

  for (const roleSlug of ['manager', 'member'] as const) {
    test(`le rôle ${roleSlug} n'accède ni aux membres ni aux paramètres`, ({ assert }) => {
      assert.notIncludeMembers(routesFor('both', roleSlug), [
        'organization.members',
        'organization.settings',
      ])
    })
  }

  test('chaque entrée porte une clé de libellé common.nav.*', ({ assert }) => {
    for (const item of service.itemsFor({ organizationType: 'both', roleSlug: 'owner' })) {
      assert.equal(item.labelKey, `common.nav.${item.key}`)
    }
  })
})

test.group('isActivePath', () => {
  test('correspond à la cible exacte, à ses enfants, en ignorant query et ancre', ({ assert }) => {
    assert.isTrue(isActivePath('/fr/rfqs', '/fr/rfqs'))
    assert.isTrue(isActivePath('/fr/rfqs/12', '/fr/rfqs'))
    assert.isTrue(isActivePath('/fr/rfqs?page=2', '/fr/rfqs'))
    assert.isTrue(isActivePath('/fr/rfqs#top', '/fr/rfqs'))
  })

  test('ne correspond pas à un préfixe de chemin partiel ni à une autre locale', ({ assert }) => {
    assert.isFalse(isActivePath('/fr/rfqs-archive', '/fr/rfqs'))
    assert.isFalse(isActivePath('/en/rfqs', '/fr/rfqs'))
    assert.isFalse(isActivePath('/fr', '/fr/rfqs'))
  })
})
