import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'
import CatalogueFacetBarService from '#services/catalogue_facet_bar_service'
import FilterableFacetsService from '#services/filterable_facets_service'
import { facetField } from '#shared/types/search'
import { installFakeEngine, type FakeEngineHandle } from '#tests/utils/fake_search_engine'
import { useDatabase } from '#tests/utils/setup'

/**
 * Barre de filtres dépendante de la catégorie (2e PR du modèle produit) :
 * dérivation des slugs filtrables depuis `category_attributes.is_filter` et
 * fusion des compteurs (distributions de facettes) avec les attributs résolus.
 */
async function categoryIdBySlug(slug: string): Promise<number> {
  const category = await Category.findByOrFail('slug', slug)
  return category.id
}

async function valueId(attributeSlug: string, valueSlug: string): Promise<number> {
  const row = await db
    .from('attribute_values')
    .join('attributes', 'attributes.id', 'attribute_values.attribute_id')
    .where('attributes.slug', attributeSlug)
    .where('attribute_values.slug', valueSlug)
    .select('attribute_values.id')
    .firstOrFail()
  return row.id
}

test.group('Facettes filtrables — dérivation depuis la base', (group) => {
  useDatabase(group, { seed: 'full' })

  test('liste les slugs marqués is_filter, distincts et triés', async ({ assert }) => {
    const service = await app.container.make(FilterableFacetsService)
    const slugs = await service.filterableSlugs()

    // Attributs transverses + propres aux catégories curées (seed).
    assert.includeMembers(slugs, ['cap-panels', 'color', 'color-shade', 'material'])
    // Trié ascendant et sans doublon (color est filtrable dans plusieurs catégories).
    assert.deepEqual(slugs, [...new Set(slugs)].sort())
  })
})

test.group('Barre de filtres par catégorie', (group) => {
  useDatabase(group, { seed: 'full' })

  let handle: FakeEngineHandle
  group.each.setup(() => {
    handle = installFakeEngine(true)
    return () => handle.restore()
  })

  async function service() {
    return app.container.make(CatalogueFacetBarService)
  }

  test('sans catégorie : barre vide, aucun appel au moteur', async ({ assert }) => {
    const svc = await service()
    const bar = await svc.forCategory(null)

    assert.deepEqual(bar, { attributes: [], hasCounts: false })
    assert.lengthOf(handle.engine.facetRequests, 0)
  })

  test('résout les attributs filtrables (propres + hérités) et demande leurs facettes', async ({
    assert,
  }) => {
    const categoryId = await categoryIdBySlug('casquettes-chapeaux-casquettes')

    const svc = await service()
    const bar = await svc.forCategory(categoryId)

    const slugs = bar.attributes.map((attribute) => attribute.slug)
    // Hérités de l'ancêtre « casquettes-chapeaux » (color, material, color-shade)
    // + propres à la sous-catégorie (cap-*).
    assert.includeMembers(slugs, ['color', 'material', 'color-shade', 'cap-panels'])
    // Les champs de facette demandés au moteur suivent les slugs résolus.
    const [request] = handle.engine.facetRequests
    assert.equal(request.filter.categoryId, categoryId)
    assert.sameMembers(request.facets, slugs.map(facetField))
  })

  test('fusionne les compteurs de la distribution dans les valeurs', async ({ assert }) => {
    const categoryId = await categoryIdBySlug('casquettes-chapeaux-casquettes')
    const blueId = await valueId('color', 'blue')
    const redId = await valueId('color', 'red')
    handle.engine.distribution = {
      [facetField('color')]: { [String(blueId)]: 4 },
    }

    const svc = await service()
    const bar = await svc.forCategory(categoryId)

    assert.isTrue(bar.hasCounts)
    const color = bar.attributes.find((attribute) => attribute.slug === 'color')!
    assert.equal(color.values.find((value) => value.id === blueId)!.count, 4)
    // Une valeur absente de la distribution est à 0 (masquée côté UI).
    assert.equal(color.values.find((value) => value.id === redId)!.count, 0)
  })

  test('moteur inerte : attributs renvoyés sans compteur (count null)', async ({ assert }) => {
    handle.restore()
    handle = installFakeEngine(false)
    const categoryId = await categoryIdBySlug('casquettes-chapeaux-casquettes')

    const svc = await service()
    const bar = await svc.forCategory(categoryId)

    assert.isFalse(bar.hasCounts)
    assert.isAbove(bar.attributes.length, 0)
    const color = bar.attributes.find((attribute) => attribute.slug === 'color')!
    assert.isTrue(color.values.every((value) => value.count === null))
    assert.lengthOf(handle.engine.facetRequests, 0)
  })

  test('moteur injoignable : repli sans compteur, pas d’échec', async ({ assert }) => {
    const categoryId = await categoryIdBySlug('casquettes-chapeaux-casquettes')
    handle.engine.distribution = new Error('meili down')

    const svc = await service()
    const bar = await svc.forCategory(categoryId)

    assert.isFalse(bar.hasCounts)
    assert.isAbove(bar.attributes.length, 0)
  })
})
