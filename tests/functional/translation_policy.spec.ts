import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Category from '#models/category'
import Product from '#models/product'
import ProductTranslation from '#models/product_translation'
import CategoryTranslation from '#models/category_translation'
import TranslationProvider from '#services/translation/translation_provider'
import aiConfig from '#config/ai'
import { useDatabase } from '#tests/utils/setup'
import { seededDevUser } from '#tests/utils/organizations'

/** Traducteur factice : préfixe le texte par la locale cible, sans réseau. */
class FakeTranslator extends TranslationProvider {
  readonly model = 'fake-translate'
  calls = 0
  async translate(fields: Record<string, string>, _source: string, target: string) {
    this.calls++
    return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, `[${target}] ${v}`]))
  }
}

async function translations(productId: number) {
  const rows = await ProductTranslation.query().where('productId', productId)
  return Object.fromEntries(rows.map((row) => [row.locale, row]))
}

test.group('Politique de traduction — produits', (group) => {
  useDatabase(group, { seed: 'full' })

  let translator: FakeTranslator
  group.each.setup(() => {
    translator = new FakeTranslator()
    app.container.swap(TranslationProvider, () => translator)
    aiConfig.translation.enabled = true
    return () => {
      aiConfig.translation.enabled = false
      app.container.restore(TranslationProvider)
    }
  })

  async function createProduct(client: any, user: any, body: Record<string, unknown>) {
    const crayon = await Category.findByOrFail('slug', 'crayon')
    return client
      .post('/fr/supplier/products')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({ categoryId: crayon.id, ...body })
  }

  test('création avec la seule langue source : l’autre est générée et marquée auto', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const response = await createProduct(client, user, {
      sourceLocale: 'fr',
      translations: { fr: { name: 'Gourde isotherme', description: 'Acier inox' } },
    })
    response.assertStatus(200)

    const product = await Product.findByOrFail('slug', 'gourde-isotherme')
    assert.equal(product.sourceLocale, 'fr')
    const rows = await translations(product.id)
    assert.isFalse(rows.fr.isAuto)
    assert.isTrue(rows.en.isAuto)
    assert.equal(rows.en.name, '[en] Gourde isotherme')

    // search_vector calculé aussi pour la traduction auto (#94).
    const vector = await db.from('product_translations').where('id', rows.en.id).first()
    assert.isNotNull(vector.search_vector)
  })

  test('une langue source autre que fr est acceptée', async ({ client, assert }) => {
    const user = await seededDevUser('eurogoods-org')
    const response = await createProduct(client, user, {
      sourceLocale: 'en',
      translations: { en: { name: 'Steel bottle' } },
    })
    response.assertStatus(200)

    const product = await Product.findByOrFail('slug', 'steel-bottle')
    assert.equal(product.sourceLocale, 'en')
    const rows = await translations(product.id)
    assert.isFalse(rows.en.isAuto)
    assert.equal(rows.fr.name, '[fr] Steel bottle')
  })

  test('la traduction de la langue source est obligatoire', async ({ client, assert }) => {
    const user = await seededDevUser('eurogoods-org')
    // Erreur de validation Inertia : redirection avec erreurs de session, rien n'est créé.
    await createProduct(client, user, {
      sourceLocale: 'fr',
      translations: { en: { name: 'Only english' } },
    })
    assert.isNull(await Product.findBy('slug', 'only-english'))
  })

  test('une traduction saisie à la main n’est jamais écrasée par l’auto', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    await createProduct(client, user, {
      sourceLocale: 'fr',
      translations: {
        fr: { name: 'Carnet recyclé' },
        en: { name: 'Recycled notebook (mine)' },
      },
    }).then((r) => r.assertStatus(200))

    const product = await Product.findByOrFail('slug', 'carnet-recycle')
    const rows = await translations(product.id)
    assert.isFalse(rows.en.isAuto)
    assert.equal(rows.en.name, 'Recycled notebook (mine)')
    assert.equal(translator.calls, 0)
  })

  test('mise à jour partielle : une seule langue, le reste est conservé', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')
    const before = await Product.findOrFail(product.id)
    const facetsBefore = await before.related('attributeValues').query()

    const response = await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({ translations: { en: { description: 'Corrected description' } } })
    response.assertStatus(200)

    await product.refresh()
    assert.equal(product.slug, before.slug)
    assert.equal(product.currency, before.currency)
    assert.equal(product.priceMin, before.priceMin)
    assert.lengthOf(await product.related('attributeValues').query(), facetsBefore.length)
    const rows = await translations(product.id)
    assert.equal(rows.en.description, 'Corrected description')
    assert.isFalse(rows.en.isAuto)
  })

  test('renvoyer une traduction auto inchangée la laisse auto', async ({ client, assert }) => {
    const user = await seededDevUser('eurogoods-org')
    await createProduct(client, user, {
      sourceLocale: 'fr',
      translations: { fr: { name: 'Stylo bambou' } },
    }).then((r) => r.assertStatus(200))
    const product = await Product.findByOrFail('slug', 'stylo-bambou')
    const { en: auto } = await translations(product.id)

    await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({ translations: { fr: { name: 'Stylo bambou' }, en: { name: auto.name } } })
      .then((r) => r.assertStatus(200))

    const { en: after } = await translations(product.id)
    assert.isTrue(after.isAuto)
  })

  test('modifier le texte source régénère la traduction auto', async ({ client, assert }) => {
    const user = await seededDevUser('eurogoods-org')
    await createProduct(client, user, {
      sourceLocale: 'fr',
      translations: { fr: { name: 'Parapluie' } },
    }).then((r) => r.assertStatus(200))
    const product = await Product.findByOrFail('slug', 'parapluie')

    await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({ translations: { fr: { name: 'Parapluie pliable' } } })
      .then((r) => r.assertStatus(200))

    const rows = await translations(product.id)
    assert.equal(rows.en.name, '[en] Parapluie pliable')
    assert.isTrue(rows.en.isAuto)
  })
})

test.group('Politique de traduction — catégories', (group) => {
  useDatabase(group, { seed: 'full' })

  test('création : langue source seule, l’autre est générée', async ({ client, assert }) => {
    const translator = new FakeTranslator()
    app.container.swap(TranslationProvider, () => translator)
    aiConfig.translation.enabled = true
    try {
      const owner = await seededDevUser('eurogoods-org')
      await client
        .post('/fr/admin/categories')
        .withInertia()
        .withCsrfToken()
        .loginAs(owner)
        .json({
          slug: 'textile',
          sourceLocale: 'fr',
          translations: { fr: { name: 'Textile' } },
        })
        .then((r) => r.assertStatus(200))

      const category = await Category.findByOrFail('slug', 'textile')
      const rows = await CategoryTranslation.query().where('categoryId', category.id)
      const byLocale = Object.fromEntries(rows.map((row) => [row.locale, row]))
      assert.isFalse(byLocale.fr.isAuto)
      assert.isTrue(byLocale.en.isAuto)
    } finally {
      aiConfig.translation.enabled = false
      app.container.restore(TranslationProvider)
    }
  })
})
