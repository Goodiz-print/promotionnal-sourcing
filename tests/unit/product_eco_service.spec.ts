import { test } from '@japa/runner'
import ProductEcoService from '#services/product_eco_service'

/**
 * Dérivation « Éco-responsable » (écart 4) — logique pure, sans base. Un produit
 * est éco si **l'un** des critères est vrai : part de recyclé > 0, matière
 * éco-responsable (bio/recyclé/naturel), ou au moins un label éco.
 */
test.group('ProductEcoService — dérivation is_eco', () => {
  const service = new ProductEcoService()

  test('recyclé > 0 → éco', ({ assert }) => {
    assert.isTrue(
      service.deriveIsEco({
        recycledContentPercent: 10,
        materialSlugs: ['plastic'],
        hasEcoCertification: false,
      })
    )
  })

  test('matière éco (coton bio) → éco', ({ assert }) => {
    assert.isTrue(
      service.deriveIsEco({
        recycledContentPercent: null,
        materialSlugs: ['organic-cotton'],
        hasEcoCertification: false,
      })
    )
  })

  test('label éco → éco', ({ assert }) => {
    assert.isTrue(
      service.deriveIsEco({
        recycledContentPercent: 0,
        materialSlugs: ['cotton'],
        hasEcoCertification: true,
      })
    )
  })

  test('aucun critère → non éco', ({ assert }) => {
    assert.isFalse(
      service.deriveIsEco({
        recycledContentPercent: null,
        materialSlugs: ['cotton', 'plastic'],
        hasEcoCertification: false,
      })
    )
    // Recyclé à 0 ne compte pas.
    assert.isFalse(
      service.deriveIsEco({
        recycledContentPercent: 0,
        materialSlugs: [],
        hasEcoCertification: false,
      })
    )
  })
})
