import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import CatalogueNumericFacetService from '#services/catalogue_numeric_facet_service'
import { installFakeEngine, type FakeEngineHandle } from '#tests/utils/fake_search_engine'
import type { ProductDirectoryFilters } from '#shared/types/product'
import { MOQ_FACET_FIELD, PRICE_FACET_FIELD } from '#shared/types/search'

/**
 * Barre de facettes numériques prix / MOQ (plan L125) : transverse aux catégories,
 * compteurs par bucket issus de la distribution de facettes du moteur
 * (`facetDistribution` sur `priceMin` / `moq`, agrégée en tranches `[min, max[`),
 * cadrage excluant le champ compté, repli sans compteur si le moteur est inerte
 * ou injoignable. Le service ne touche pas la base (moteur factice seul).
 */
const NO_FILTERS: ProductDirectoryFilters = {
  search: null,
  categoryId: null,
  madeInEurope: false,
  attributeValueIds: [],
  certificationIds: [],
  originZones: [],
  stockStatuses: [],
  priceBuckets: [],
  moqBuckets: [],
  attributeRanges: [],
  newOnly: false,
  ecoOnly: false,
}

test.group('Barre de facettes numériques (prix/MOQ)', (group) => {
  let handle: FakeEngineHandle
  group.each.setup(() => {
    handle = installFakeEngine(true)
    return () => handle.restore()
  })

  async function service() {
    return app.container.make(CatalogueNumericFacetService)
  }

  test('compte chaque bucket depuis la distribution, en un seul appel sans sélection', async ({
    assert,
  }) => {
    // 0.5 → bucket 0 (<1) ; 1.5 → bucket 1 (1–2) ; 3 → bucket 2 (2–5) ; 75 → MOQ bucket 1 (50–100).
    handle.engine.distribution = {
      [PRICE_FACET_FIELD]: { '0.5': 2, '1.5': 3, '3': 1 },
      [MOQ_FACET_FIELD]: { '75': 4 },
    }

    const svc = await service()
    const bar = await svc.forCatalogue(NO_FILTERS)

    // Sans tranche cochée : un seul appel demandant les deux champs.
    assert.lengthOf(handle.engine.facetRequests, 1)
    assert.deepEqual(handle.engine.facetRequests[0].facets, [PRICE_FACET_FIELD, MOQ_FACET_FIELD])

    assert.isTrue(bar.price.hasCounts)
    assert.deepEqual(
      bar.price.buckets.map((bucket) => bucket.count),
      [2, 3, 1, 0, 0, 0]
    )
    assert.deepEqual(
      bar.moq.buckets.map((bucket) => bucket.count),
      [0, 4, 0, 0, 0, 0]
    )
    // Les index sont renvoyés tels quels (pour que l'UI puisse cocher/décocher).
    assert.deepEqual(
      bar.price.buckets.map((bucket) => bucket.index),
      [0, 1, 2, 3, 4, 5]
    )
  })

  test('un bucket coché : deux appels, chaque champ exclut ses propres tranches', async ({
    assert,
  }) => {
    // Prix coché (bucket 2 = 2–5 €) : la distribution du prix doit s'exclure
    // elle-même (priceRanges vide) tandis que celle du MOQ garde le filtre prix.
    const svc = await service()
    await svc.forCatalogue({ ...NO_FILTERS, priceBuckets: [2] })

    assert.lengthOf(handle.engine.facetRequests, 2)
    const [priceReq, moqReq] = handle.engine.facetRequests
    assert.deepEqual(priceReq.facets, [PRICE_FACET_FIELD])
    assert.deepEqual(moqReq.facets, [MOQ_FACET_FIELD])
    // La distribution du prix ne se filtre pas elle-même.
    assert.deepEqual(priceReq.filter.priceRanges, [])
    // Mais celle du MOQ est cadrée par la tranche de prix cochée.
    assert.deepEqual(moqReq.filter.priceRanges, [{ min: 2, max: 5 }])
  })

  test('moteur inerte : buckets renvoyés sans compteur (count null), aucun appel', async ({
    assert,
  }) => {
    handle.restore()
    handle = installFakeEngine(false)

    const svc = await service()
    const bar = await svc.forCatalogue(NO_FILTERS)

    assert.isFalse(bar.price.hasCounts)
    assert.isFalse(bar.moq.hasCounts)
    assert.isTrue(bar.price.buckets.every((bucket) => bucket.count === null))
    assert.lengthOf(handle.engine.facetRequests, 0)
  })

  test('moteur injoignable : repli sans compteur, pas d’échec', async ({ assert }) => {
    handle.engine.distribution = new Error('meili down')

    const svc = await service()
    const bar = await svc.forCatalogue(NO_FILTERS)

    assert.isFalse(bar.price.hasCounts)
    assert.isFalse(bar.moq.hasCounts)
  })
})
