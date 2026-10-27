import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import Certification from '#models/certification'
import CatalogueCertificationFacetService from '#services/catalogue_certification_facet_service'
import { CERTIFICATION_FACET_FIELD } from '#shared/types/search'
import type { ProductDirectoryFilters } from '#shared/types/product'
import { installFakeEngine, type FakeEngineHandle } from '#tests/utils/fake_search_engine'
import { useDatabase } from '#tests/utils/setup'

/**
 * Barre de filtres certifications (écart 4, ÉTAPE 6) : transverse aux catégories,
 * compteurs issus de la distribution de facettes du moteur
 * (`facetDistribution` sur `certificationIds`), repli sans compteur si le moteur
 * est indisponible.
 */
const NO_FILTERS: ProductDirectoryFilters = {
  search: null,
  categoryId: null,
  madeInEurope: false,
  attributeValueIds: [],
  certificationIds: [],
  originZones: [],
  newOnly: false,
  ecoOnly: false,
}

test.group('Barre de filtres certifications', (group) => {
  useDatabase(group, { seed: 'full' })

  let handle: FakeEngineHandle
  group.each.setup(() => {
    handle = installFakeEngine(true)
    return () => handle.restore()
  })

  async function service() {
    return app.container.make(CatalogueCertificationFacetService)
  }

  test('expose le référentiel des labels, groupés par domaine via leur colonne', async ({
    assert,
  }) => {
    const svc = await service()
    const bar = await svc.forCatalogue(NO_FILTERS)

    // Le référentiel fermé est renvoyé en entier (~29 labels), avec slug + domaine.
    assert.isAbove(bar.certifications.length, 10)
    const gots = bar.certifications.find((certification) => certification.slug === 'gots')!
    assert.equal(gots.domain, 'textile')
  })

  test('fusionne les compteurs de la distribution dans les labels', async ({ assert }) => {
    const gots = await Certification.findByOrFail('slug', 'gots')
    const fsc = await Certification.findByOrFail('slug', 'fsc')
    handle.engine.distribution = {
      [CERTIFICATION_FACET_FIELD]: { [String(gots.id)]: 5 },
    }

    const svc = await service()
    const bar = await svc.forCatalogue(NO_FILTERS)

    assert.isTrue(bar.hasCounts)
    assert.equal(bar.certifications.find((c) => c.id === gots.id)!.count, 5)
    // Un label absent de la distribution est à 0 (masqué côté UI).
    assert.equal(bar.certifications.find((c) => c.id === fsc.id)!.count, 0)

    // La facette demandée est le champ plat `certificationIds`.
    const [request] = handle.engine.facetRequests
    assert.deepEqual(request.facets, [CERTIFICATION_FACET_FIELD])
  })

  test('la distribution exclut les labels déjà cochés de son filtre de cadrage', async ({
    assert,
  }) => {
    const gots = await Certification.findByOrFail('slug', 'gots')

    const svc = await service()
    await svc.forCatalogue({ ...NO_FILTERS, categoryId: 1, certificationIds: [gots.id] })

    const [request] = handle.engine.facetRequests
    // Le cadrage garde la catégorie mais pas les certifications cochées : un label
    // coché garde ainsi un compteur, et les autres restent non nuls.
    assert.equal(request.filter.categoryId, 1)
    assert.isUndefined(request.filter.certificationIds)
  })

  test('moteur inerte : labels renvoyés sans compteur (count null)', async ({ assert }) => {
    handle.restore()
    handle = installFakeEngine(false)

    const svc = await service()
    const bar = await svc.forCatalogue(NO_FILTERS)

    assert.isFalse(bar.hasCounts)
    assert.isAbove(bar.certifications.length, 0)
    assert.isTrue(bar.certifications.every((certification) => certification.count === null))
    assert.lengthOf(handle.engine.facetRequests, 0)
  })

  test('moteur injoignable : repli sans compteur, pas d’échec', async ({ assert }) => {
    handle.engine.distribution = new Error('meili down')

    const svc = await service()
    const bar = await svc.forCatalogue(NO_FILTERS)

    assert.isFalse(bar.hasCounts)
    assert.isAbove(bar.certifications.length, 0)
  })
})
