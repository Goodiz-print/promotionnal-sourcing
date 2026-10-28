import { test } from '@japa/runner'
import ProductStockService from '#services/product_stock_service'
import type { ProductStockStatus } from '#shared/types/product'

/**
 * Agrégation du statut de stock au niveau produit (plan L98) — logique pure,
 * sans base. Sémantique « priorité au disponible », variantes inactives
 * ignorées, `null` quand aucune variante active ne porte de statut.
 */
test.group('ProductStockService — agrégation du statut', () => {
  const service = new ProductStockService()
  const active = (stockStatus: ProductStockStatus | null) => ({ isActive: true, stockStatus })

  test('in_stock dès qu’une variante active est disponible', ({ assert }) => {
    assert.equal(service.deriveStatus([active('in_stock')]), 'in_stock')
    // Priorité au disponible : prime sur sur-commande et épuisé.
    assert.equal(
      service.deriveStatus([active('out_of_stock'), active('on_order'), active('in_stock')]),
      'in_stock'
    )
  })

  test('on_order si pas de disponible mais au moins une sur commande', ({ assert }) => {
    assert.equal(service.deriveStatus([active('out_of_stock'), active('on_order')]), 'on_order')
    assert.equal(service.deriveStatus([active('on_order')]), 'on_order')
  })

  test('out_of_stock si seulement des variantes épuisées', ({ assert }) => {
    assert.equal(
      service.deriveStatus([active('out_of_stock'), active('out_of_stock')]),
      'out_of_stock'
    )
  })

  test('null si aucune variante active ne porte de statut', ({ assert }) => {
    assert.isNull(service.deriveStatus([]))
    assert.isNull(service.deriveStatus([active(null), active(null)]))
  })

  test('les variantes inactives sont ignorées', ({ assert }) => {
    // La seule variante disponible est inactive → elle ne compte pas.
    assert.equal(
      service.deriveStatus([{ isActive: false, stockStatus: 'in_stock' }, active('out_of_stock')]),
      'out_of_stock'
    )
    // Toutes les variantes porteuses de statut sont inactives → null.
    assert.isNull(
      service.deriveStatus([
        { isActive: false, stockStatus: 'in_stock' },
        { isActive: false, stockStatus: 'on_order' },
      ])
    )
  })
})
