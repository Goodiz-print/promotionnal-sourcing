import { test } from '@japa/runner'
import ProductOriginService from '#services/product_origin_service'

/**
 * Dérivation de la zone de provenance (écart 9) — logique pure, sans base. On
 * éprouve les 4 cas : France, Europe (UE/EEE ou `madeInEurope`), autre, et
 * origine inconnue (`null`, exclue des cases France/Europe).
 */
test.group('ProductOriginService — dérivation de zone', () => {
  const service = new ProductOriginService()

  test('FR → france', ({ assert }) => {
    assert.equal(service.deriveZone('FR', false), 'france')
    // Insensible à la casse et aux espaces.
    assert.equal(service.deriveZone(' fr ', false), 'france')
  })

  test('pays UE/EEE → europe', ({ assert }) => {
    assert.equal(service.deriveZone('DE', false), 'europe')
    assert.equal(service.deriveZone('SE', false), 'europe')
    // Islande (EEE hors UE) compte comme Europe.
    assert.equal(service.deriveZone('IS', false), 'europe')
  })

  test('madeInEurope sans pays, ou avec pays hors Europe → europe', ({ assert }) => {
    assert.equal(service.deriveZone(null, true), 'europe')
    // Le drapeau prime sur un pays hors Europe (le fournisseur déclare l'Europe).
    assert.equal(service.deriveZone('CN', true), 'europe')
  })

  test('pays connu hors Europe → other', ({ assert }) => {
    assert.equal(service.deriveZone('CN', false), 'other')
    assert.equal(service.deriveZone('US', false), 'other')
  })

  test('origine inconnue → null (exclue des cases France/Europe)', ({ assert }) => {
    assert.isNull(service.deriveZone(null, false))
    assert.isNull(service.deriveZone('', false))
    // Code pays inconnu du référentiel : traité comme inconnu.
    assert.isNull(service.deriveZone('ZZ', false))
  })
})
