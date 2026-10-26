import { test } from '@japa/runner'
import Product from '#models/product'
import MarkingTechnique from '#models/marking_technique'
import ProductMarkingPosition from '#models/product_marking_position'
import ProductMarkingPriceTier from '#models/product_marking_price_tier'
import ProductDocument from '#models/product_document'
import { ProductMarkingPositionFactory } from '#database/factories/product_marking_position_factory'
import { ProductMarkingPositionTechniqueFactory } from '#database/factories/product_marking_position_technique_factory'
import { ProductMarkingPriceTierFactory } from '#database/factories/product_marking_price_tier_factory'
import { ProductDocumentFactory } from '#database/factories/product_document_factory'
import { useDatabase } from '#tests/utils/setup'
import { seededDevUser } from '#tests/utils/organizations'

/**
 * Marquage structuré (écart 2) : positions + techniques + grille de prix en
 * remplacement d'ensemble (comme variantes / paliers), cascade de suppression,
 * contrainte du gabarit, et résolution i18n des techniques.
 */
test.group('Marquage produit fournisseur (écart 2)', (group) => {
  useDatabase(group, { seed: 'full' })

  /** Base d'un payload de mise à jour valide (langue source déjà semée). */
  function baseUpdate(product: Product) {
    return {
      categoryId: product.categoryId,
      translations: {
        fr: { name: 'Produit marqué', description: null },
        en: { name: 'Marked product', description: null },
      },
    }
  }

  test('ajoute positions, techniques et grille de prix de marquage', async ({ client, assert }) => {
    const user = await seededDevUser('eurogoods-org')
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')
    const embroidery = await MarkingTechnique.findByOrFail('slug', 'embroidery')
    const transfer = await MarkingTechnique.findByOrFail('slug', 'transfer')

    const response = await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({
        ...baseUpdate(product),
        printable: true,
        markingPositions: [
          {
            name: 'Corps',
            maxWidthMm: 40,
            maxHeightMm: 10,
            techniques: [
              { markingTechniqueId: embroidery.id, maxColors: 4, defaultSetupCharge: 25 },
              { markingTechniqueId: transfer.id },
            ],
          },
        ],
        markingPriceTiers: [
          { markingTechniqueId: embroidery.id, minQuantity: 100, unitPrice: 0.5 },
          { markingTechniqueId: embroidery.id, minQuantity: 500, unitPrice: 0.35 },
        ],
      })

    response.assertStatus(200)

    await product.refresh()
    assert.isTrue(product.printable)

    const positions = await ProductMarkingPosition.query()
      .where('productId', product.id)
      .preload('techniques')
    assert.lengthOf(positions, 1)
    assert.equal(positions[0].name, 'Corps')
    assert.equal(positions[0].position, 0)
    assert.lengthOf(positions[0].techniques, 2)

    const tiers = await ProductMarkingPriceTier.query().where('productId', product.id)
    assert.lengthOf(tiers, 2)
    assert.equal(tiers[0].currency, 'EUR')
  })

  test('remplace entièrement positions et grille (un tableau réécrit tout)', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')
    const embroidery = await MarkingTechnique.findByOrFail('slug', 'embroidery')
    const pad = await MarkingTechnique.findByOrFail('slug', 'pad-printing')

    // Premier état : 2 positions + 2 paliers.
    await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({
        ...baseUpdate(product),
        markingPositions: [
          { name: 'Devant', techniques: [{ markingTechniqueId: embroidery.id }] },
          { name: 'Dos', techniques: [{ markingTechniqueId: pad.id }] },
        ],
        markingPriceTiers: [
          { markingTechniqueId: embroidery.id, minQuantity: 50, unitPrice: 1 },
          { markingTechniqueId: pad.id, minQuantity: 50, unitPrice: 0.4 },
        ],
      })

    // Second état : 1 position, grille vide → l'ancien est entièrement remplacé.
    await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({
        ...baseUpdate(product),
        markingPositions: [{ name: 'Côté', techniques: [{ markingTechniqueId: pad.id }] }],
        markingPriceTiers: [],
      })

    const positions = await ProductMarkingPosition.query().where('productId', product.id)
    assert.lengthOf(positions, 1)
    assert.equal(positions[0].name, 'Côté')
    const tiers = await ProductMarkingPriceTier.query().where('productId', product.id)
    assert.lengthOf(tiers, 0)
  })

  test('la suppression du produit supprime le marquage en cascade', async ({ client, assert }) => {
    const user = await seededDevUser('eurogoods-org')
    const product = await Product.findByOrFail('slug', 'crayon-hb-rouge')
    const embroidery = await MarkingTechnique.findByOrFail('slug', 'embroidery')

    // Marquage mis en place via les factories.
    const position = await ProductMarkingPositionFactory.merge({ productId: product.id }).create()
    await ProductMarkingPositionTechniqueFactory.merge({
      markingPositionId: position.id,
      markingTechniqueId: embroidery.id,
    }).create()
    await ProductMarkingPriceTierFactory.merge({
      productId: product.id,
      markingTechniqueId: embroidery.id,
    }).create()

    const response = await client
      .delete(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)

    response.assertStatus(200)
    assert.isNull(await Product.find(product.id))
    assert.lengthOf(await ProductMarkingPosition.query().where('productId', product.id), 0)
    assert.lengthOf(await ProductMarkingPriceTier.query().where('productId', product.id), 0)
  })

  test('une technique inconnue est rejetée (aucune ligne persistée)', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')

    await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({
        ...baseUpdate(product),
        markingPriceTiers: [{ markingTechniqueId: 999999, minQuantity: 100, unitPrice: 0.5 }],
      })

    // La transaction est annulée : aucun palier de marquage n'est créé.
    assert.lengthOf(await ProductMarkingPriceTier.query().where('productId', product.id), 0)
  })

  test('le gabarit doit être un document du produit de type marking_template', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')

    // Document du produit, mais de type fiche technique : refusé comme gabarit.
    const document = await ProductDocumentFactory.merge({
      productId: product.id,
      type: 'spec_sheet',
    }).create()

    await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({
        ...baseUpdate(product),
        markingPositions: [{ name: 'Devant', templateDocumentId: document.id, techniques: [] }],
      })

    assert.lengthOf(await ProductMarkingPosition.query().where('productId', product.id), 0)

    // Reclassé en gabarit de marquage : la position est alors acceptée.
    document.type = 'marking_template'
    await document.save()

    const response = await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({
        ...baseUpdate(product),
        markingPositions: [{ name: 'Devant', templateDocumentId: document.id, techniques: [] }],
      })

    response.assertStatus(200)
    const positions = await ProductMarkingPosition.query().where('productId', product.id)
    assert.lengthOf(positions, 1)
    assert.equal(positions[0].templateDocumentId, document.id)
  })

  test('les techniques sont résolues dans la locale active (fr vs en)', async ({
    client,
    assert,
  }) => {
    // La casquette de démo porte un marquage (broderie, transfert…) semé.
    const fr = await client.get('/fr/products/casquette-6-panneaux-marine').withInertia()
    fr.assertStatus(200)
    const en = await client.get('/en/products/casquette-6-panneaux-marine').withInertia()
    en.assertStatus(200)

    const frNames = fr.inertiaProps.product.markingPositions
      .flatMap((position: { techniques: { techniqueName: string }[] }) => position.techniques)
      .map((technique: { techniqueName: string }) => technique.techniqueName)
    const enNames = en.inertiaProps.product.markingPositions
      .flatMap((position: { techniques: { techniqueName: string }[] }) => position.techniques)
      .map((technique: { techniqueName: string }) => technique.techniqueName)

    assert.include(frNames, 'Broderie')
    assert.include(enNames, 'Embroidery')
  })
})
