import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Attribute from '#models/attribute'
import Category from '#models/category'
import Role from '#models/role'
import ReferenceSeeder from '#database/seeders/reference_seeder'
import { CATEGORY_TREE } from '#database/data/catalogue/categories'
import { useDatabase } from '#tests/utils/setup'

function runSeeder() {
  return new ReferenceSeeder(db.connection()).run()
}

async function countOf(table: string): Promise<number> {
  const row = await db.from(table).count('* as total').firstOrFail()
  return Number(row.total)
}

test.group('ReferenceSeeder — référentiel de la production', (group) => {
  useDatabase(group, { seed: 'none' })

  test('sème rôles et permissions : le rôle owner a ses droits', async ({ assert }) => {
    await runSeeder()

    const owner = await Role.query().where('slug', 'owner').preload('permissions').firstOrFail()
    const slugs = owner.permissions.map((permission) => permission.slug)
    assert.includeMembers(slugs, ['organization:manage', 'members:invite', 'billing:manage'])
  })

  test('sème le catalogue de référence : arbre, attributs, labels, techniques', async ({
    assert,
  }) => {
    await runSeeder()

    const categories = await Category.query().whereIn(
      'slug',
      CATEGORY_TREE.map((seed) => seed.slug)
    )
    const attributes = await Attribute.query().whereIn('slug', ['color', 'material'])
    const slugById = new Map(categories.map((category) => [category.id, category.slug]))
    const parentOf = Object.fromEntries(CATEGORY_TREE.map((seed) => [seed.slug, seed.parentSlug]))
    assert.lengthOf(categories, CATEGORY_TREE.length)
    categories.forEach((category) => {
      const parentSlug = category.parentId === null ? null : slugById.get(category.parentId)
      assert.equal(parentSlug, parentOf[category.slug], `parent de ${category.slug}`)
    })
    assert.lengthOf(attributes, 2)
    assert.isAbove(await countOf('certifications'), 0)
    assert.isAbove(await countOf('marking_techniques'), 0)
  })

  test('ne crée aucune donnée de démo', async ({ assert }) => {
    await runSeeder()

    assert.equal(await countOf('users'), 0)
    assert.equal(await countOf('organizations'), 0)
    assert.equal(await countOf('suppliers'), 0)
    assert.equal(await countOf('products'), 0)
    assert.isNull(await Category.findBy('slug', 'crayon'))
  })

  test('relançable : aucun doublon', async ({ assert }) => {
    await runSeeder()
    const categories = await countOf('categories')
    const roles = await countOf('roles')

    await runSeeder()

    assert.equal(await countOf('categories'), categories)
    assert.equal(await countOf('roles'), roles)
  })
})
