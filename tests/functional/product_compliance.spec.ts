import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import Category from '#models/category'
import AttributeValue from '#models/attribute_value'
import Certification from '#models/certification'
import Product from '#models/product'
import { ProductDocumentFactory } from '#database/factories/product_document_factory'
import { useDatabase } from '#tests/utils/setup'
import { seededDevUser } from '#tests/utils/organizations'

/**
 * Conformité produit (écart 4) : persistance des champs saisis (recyclé,
 * mise en garde, labels), dérivation du filtre « Éco-responsable » (`is_eco`)
 * pour ses cas vrai/faux, filtrage catalogue « Éco-responsable », et nature
 * (`type`) d'une fiche PDF produit.
 */
test.group('Conformité produit — persistance & dérivation is_eco', (group) => {
  useDatabase(group, { seed: 'full' })

  /** Crée un produit fournisseur via l'endpoint et renvoie la ligne rechargée. */
  async function createProduct(
    client: ApiClient,
    slug: string,
    overrides: Record<string, unknown>
  ): Promise<Product> {
    const user = await seededDevUser('eurogoods-org')
    const crayon = await Category.findByOrFail('slug', 'crayon')

    const response = await client
      .post('/fr/supplier/products')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({
        categoryId: crayon.id,
        sourceLocale: 'fr',
        translations: {
          fr: { name: slug, description: null },
          en: { name: slug, description: null },
        },
        isActive: true,
        ...overrides,
      })
    response.assertStatus(200)

    return Product.query()
      .where('slug', slug)
      .preload('certifications')
      .preload('attributeValues')
      .firstOrFail()
  }

  test('persiste recyclé + mise en garde + labels ; is_eco vrai via le recyclé', async ({
    client,
    assert,
  }) => {
    const cotton = await AttributeValue.findByOrFail('value', 'cotton')
    const gots = await Certification.findByOrFail('slug', 'gots')

    const product = await createProduct(client, 'conformite-recycle', {
      recycledContentPercent: 20,
      cautionComment: 'Tenir à l’écart des flammes.',
      attributeValueIds: [cotton.id],
      certificationIds: [gots.id],
    })

    assert.equal(product.recycledContentPercent, 20)
    assert.equal(product.cautionComment, 'Tenir à l’écart des flammes.')
    assert.includeMembers(
      product.certifications.map((c) => c.slug),
      ['gots']
    )
    // Recyclé > 0 → éco-responsable.
    assert.isTrue(product.isEco)
  })

  test('is_eco faux : ni recyclé, ni matière éco, ni label éco', async ({ client, assert }) => {
    const cotton = await AttributeValue.findByOrFail('value', 'cotton')
    const ce = await Certification.findByOrFail('slug', 'ce')

    const product = await createProduct(client, 'conformite-non-eco', {
      attributeValueIds: [cotton.id],
      certificationIds: [ce.id],
    })

    assert.isFalse(product.isEco)
  })

  test('is_eco vrai via une matière éco (coton bio) seule', async ({ client, assert }) => {
    const organicCotton = await AttributeValue.findByOrFail('value', 'organic-cotton')

    const product = await createProduct(client, 'conformite-matiere-eco', {
      attributeValueIds: [organicCotton.id],
    })

    assert.isTrue(product.isEco)
  })

  test('is_eco vrai via un label éco (GOTS) seul', async ({ client, assert }) => {
    const cotton = await AttributeValue.findByOrFail('value', 'cotton')
    const gots = await Certification.findByOrFail('slug', 'gots')

    const product = await createProduct(client, 'conformite-label-eco', {
      attributeValueIds: [cotton.id],
      certificationIds: [gots.id],
    })

    assert.isTrue(product.isEco)
  })

  test('la mise à jour recalcule is_eco quand on retire ce qui le rendait éco', async ({
    client,
    assert,
  }) => {
    const cotton = await AttributeValue.findByOrFail('value', 'cotton')

    const product = await createProduct(client, 'conformite-bascule', {
      recycledContentPercent: 50,
      attributeValueIds: [cotton.id],
    })
    assert.isTrue(product.isEco)

    const user = await seededDevUser('eurogoods-org')
    const response = await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({ recycledContentPercent: null, certificationIds: [], attributeValueIds: [cotton.id] })
    response.assertStatus(200)

    await product.refresh()
    assert.isFalse(product.isEco)
  })

  test('le filtre « Éco-responsable » ne renvoie que les produits is_eco', async ({
    client,
    assert,
  }) => {
    const organicCotton = await AttributeValue.findByOrFail('value', 'organic-cotton')
    const cotton = await AttributeValue.findByOrFail('value', 'cotton')

    await createProduct(client, 'filtre-eco-oui', { attributeValueIds: [organicCotton.id] })
    await createProduct(client, 'filtre-eco-non', { attributeValueIds: [cotton.id] })

    const response = await client.get('/fr/products').qs({ ecoOnly: 'true' }).withInertia()
    const slugs = response.inertiaProps.products.data.map((p: { slug: string }) => p.slug)

    assert.include(slugs, 'filtre-eco-oui')
    assert.notInclude(slugs, 'filtre-eco-non')
    // Le produit de démo « casquette » (coton bio + GOTS + recyclé) est éco.
    assert.include(slugs, 'casquette-6-panneaux-marine')
  })

  test('un id de label inexistant est ignoré (pas de 500 sur clé étrangère)', async ({
    client,
    assert,
  }) => {
    const gots = await Certification.findByOrFail('slug', 'gots')

    // Le second id n'existe pas : il doit être écarté, pas provoquer une
    // violation de clé étrangère. Seul le label valide est synchronisé.
    const product = await createProduct(client, 'conformite-label-inconnu', {
      certificationIds: [gots.id, 999_999],
    })

    assert.deepEqual(
      product.certifications.map((c) => c.slug),
      ['gots']
    )
  })

  test('product_documents.type : nature saisie et valeur par défaut', async ({ assert }) => {
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')

    const certificate = await ProductDocumentFactory.merge({
      productId: product.id,
      type: 'certificate',
    }).create()
    await certificate.refresh()
    assert.equal(certificate.type, 'certificate')

    // Sans `type`, la colonne retombe sur la valeur par défaut `spec_sheet`.
    const defaulted = await ProductDocumentFactory.merge({ productId: product.id }).create()
    await defaulted.refresh()
    assert.equal(defaulted.type, 'spec_sheet')
  })
})
