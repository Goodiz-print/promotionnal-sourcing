import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import Category from '#models/category'
import Attribute from '#models/attribute'
import AttributeValue from '#models/attribute_value'
import Product from '#models/product'
import CatalogueFacetsService from '#services/catalogue_facets_service'
import { ProductPublicationBlockedException } from '#exceptions/catalogue_errors'
import { useDatabase } from '#tests/utils/setup'

const CAP_CATEGORY = 'casquettes-chapeaux-casquettes'
const GOURDE_CATEGORY = 'boissons-gourdes-et-bouteilles'

async function facets() {
  return app.container.make(CatalogueFacetsService)
}

async function attributeId(slug: string): Promise<number> {
  const attribute = await Attribute.findByOrFail('slug', slug)
  return attribute.id
}

test.group('Catalogue — résolution des facettes par catégorie', (group) => {
  useDatabase(group, { seed: 'full', perTest: false })

  test('un attribut est résolu depuis la catégorie ET tous ses ancêtres, trié par position', async ({
    assert,
  }) => {
    const casquettes = await Category.findByOrFail('slug', CAP_CATEGORY)
    const service = await facets()
    const resolved = await service.resolveForCategory(casquettes.id, 'fr')

    // color/material/color-shade viennent du N1 (hérités), cap-* du N2 (propres).
    assert.deepEqual(
      resolved.map((facet) => facet.slug),
      ['color', 'material', 'color-shade', 'cap-panels', 'cap-type', 'cap-closure', 'cap-weight']
    )
    // Positions croissantes : les filtres communs (1-3) avant les propres (10+).
    const positions = resolved.map((facet) => facet.position)
    assert.deepEqual(
      positions,
      [...positions].sort((a, b) => a - b)
    )
  })

  test('les facettes héritées portent la catégorie d’origine (ancêtre), pas la catégorie demandée', async ({
    assert,
  }) => {
    const casquettes = await Category.findByOrFail('slug', CAP_CATEGORY)
    const parent = await Category.findByOrFail('slug', 'casquettes-chapeaux')
    const service = await facets()
    const resolved = await service.resolveForCategory(casquettes.id)

    const color = resolved.find((facet) => facet.slug === 'color')
    const capType = resolved.find((facet) => facet.slug === 'cap-type')
    assert.equal(color!.categoryId, parent.id)
    assert.equal(capType!.categoryId, casquettes.id)
  })

  test('les tranches d’un attribut numérique sont résolues (bornes, libellé non stocké)', async ({
    assert,
  }) => {
    const gourdes = await Category.findByOrFail('slug', GOURDE_CATEGORY)
    const service = await facets()
    const resolved = await service.resolveForCategory(gourdes.id)

    const capacity = resolved.find((facet) => facet.slug === 'bottle-capacity')
    assert.exists(capacity)
    assert.lengthOf(capacity!.ranges, 4)
    assert.deepEqual(capacity!.ranges[0], { minValue: null, maxValue: 400 })
    assert.deepEqual(capacity!.ranges[3], { minValue: 900, maxValue: null })
  })

  test('resolveFilters ne renvoie que les attributs is_filter', async ({ assert }) => {
    const casquettes = await Category.findByOrFail('slug', CAP_CATEGORY)
    const service = await facets()
    const filters = await service.resolveFilters(casquettes.id)
    assert.isTrue(filters.every((facet) => facet.isFilter))
    assert.isAbove(filters.length, 0)
  })
})

test.group('Catalogue — couleur à 2 niveaux (famille → nuances)', (group) => {
  useDatabase(group, { seed: 'full', perTest: false })

  test('une nuance pointe vers sa famille via parent_value_id', async ({ assert }) => {
    const color = await Attribute.findByOrFail('slug', 'color')
    const shade = await Attribute.findByOrFail('slug', 'color-shade')

    const blueFamily = await AttributeValue.query()
      .where('attributeId', color.id)
      .andWhere('slug', 'blue')
      .firstOrFail()
    const navy = await AttributeValue.query()
      .where('attributeId', shade.id)
      .andWhere('slug', 'bleu-marine')
      .firstOrFail()

    assert.equal(navy.parentValueId, blueFamily.id)
    assert.equal(navy.hex, '#1B2A49')

    await blueFamily.load('children')
    const childSlugs = blueFamily.children.map((child) => child.slug)
    assert.includeMembers(childSlugs, ['bleu-marine', 'bleu-royal', 'bleu-ciel', 'turquoise'])
    // Les nuances d’une autre famille ne sont pas rattachées au bleu.
    assert.notInclude(childSlugs, 'rouge')
  })
})

test.group('Catalogue — garde de publication (attributs obligatoires)', (group) => {
  useDatabase(group, { seed: 'full', perTest: false })

  test('un attribut obligatoire non renseigné bloque la publication', async ({ assert }) => {
    const casquettes = await Category.findByOrFail('slug', CAP_CATEGORY)
    const service = await facets()
    // Seul cap-panels est renseigné : cap-type (obligatoire) manque.
    const present = [await attributeId('cap-panels')]

    const missing = await service.missingRequiredAttributes(casquettes.id, present)
    assert.deepEqual(missing, ['cap-type'])

    await assert.rejects(
      () => service.assertPublishable(casquettes.id, present),
      ProductPublicationBlockedException.message
    )
  })

  test('tous les attributs obligatoires renseignés : publication autorisée', async ({ assert }) => {
    const casquettes = await Category.findByOrFail('slug', CAP_CATEGORY)
    const service = await facets()
    const present = [await attributeId('cap-panels'), await attributeId('cap-type')]

    const missing = await service.missingRequiredAttributes(casquettes.id, present)
    assert.isEmpty(missing)
    await service.assertPublishable(casquettes.id, present) // ne lève pas
  })
})

test.group('Catalogue — filtrage multi-critères ET sur les nouvelles facettes', (group) => {
  useDatabase(group, { seed: 'full', perTest: false })

  test('catégorie + cap-type=baseball + couleur=blue → la casquette marine', async ({ assert }) => {
    const rows = await Product.query()
      .whereHas('category', (q) => q.where('slug', CAP_CATEGORY))
      .whereHas('attributeValues', (q) => q.where('value', 'baseball'))
      .whereHas('attributeValues', (q) => q.where('value', 'blue'))

    assert.deepEqual(
      rows.map((p) => p.slug),
      ['casquette-6-panneaux-marine']
    )
  })

  test('un critère non satisfait exclut le produit (ET strict)', async ({ assert }) => {
    const rows = await Product.query()
      .whereHas('category', (q) => q.where('slug', CAP_CATEGORY))
      .whereHas('attributeValues', (q) => q.where('value', 'trucker'))

    assert.isEmpty(rows)
  })
})
