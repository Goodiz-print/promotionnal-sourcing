import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import sharp from 'sharp'
import Category from '#models/category'
import Organization from '#models/organization'
import ProductImage from '#models/product_image'
import ProductImageVariant from '#models/product_image_variant'
import StorageObject from '#models/storage_object'
import ImageVariantService from '#services/image_variant_service'
import SupplierProductService from '#services/supplier_product_service'
import ProductImageTransformer from '#transformers/product_image_transformer'
import { useDatabase } from '#tests/utils/setup'
import { uploadedFile, useFakeStorage } from '#tests/utils/storage'

const input = (categoryId: number) => ({
  categoryId,
  sourceLocale: 'fr' as const,
  translations: {
    fr: { name: 'Sac Variantes', description: null },
    en: { name: 'Variant Bag', description: null },
  },
  attributeValueIds: [] as number[],
})

function photo(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#3366cc' } })
    .jpeg()
    .toBuffer()
}

async function createProduct(files: Awaited<ReturnType<typeof uploadedFile>>[]) {
  const org = await Organization.findByOrFail('slug', 'eurogoods-org')
  const category = await Category.findByOrFail('slug', 'sac')
  const service = await app.container.make(SupplierProductService)
  return service.create(org, input(category.id), files)
}

test.group('Variantes d’image — génération', (group) => {
  useDatabase(group, { seed: 'full' })
  const storage = useFakeStorage(group)

  test('une image uploadée reçoit ses trois variantes webp, sans agrandissement', async ({
    assert,
  }) => {
    const product = await createProduct([await uploadedFile(await photo(1000, 500), 'jpg')])
    const image = await ProductImage.query().where('productId', product.id).firstOrFail()

    const variants = await ProductImageVariant.query()
      .where('productImageId', image.id)
      .orderBy('width')
    assert.deepEqual(
      variants.map((variant) => [variant.name, variant.width, variant.height]),
      [
        ['card', 400, 200],
        ['detail', 800, 400],
        // 1000 px < 1600 : jamais agrandie.
        ['zoom', 1000, 500],
      ]
    )

    for (const variant of variants) {
      const object = await StorageObject.findOrFail(variant.storageObjectId)
      assert.equal(object.status, 'ready')
      assert.equal(object.mimeType, 'image/webp')
      assert.equal(variant.url, `https://cellar.test/test-bucket/${object.key}`)
      assert.isTrue(storage.driver.objects.has(object.key))
    }

    await image.refresh()
    assert.equal(image.width, 1000)
    assert.equal(image.height, 500)
  })

  test('rejouer la génération ne recrée ni ligne ni envoi', async ({ assert }) => {
    const product = await createProduct([await uploadedFile(await photo(1000, 500), 'jpg')])
    const image = await ProductImage.query().where('productId', product.id).firstOrFail()
    const putsBefore = storage.driver.puts.length

    const service = await app.container.make(ImageVariantService)
    await service.generate(image.id)

    assert.lengthOf(await ProductImageVariant.query().where('productImageId', image.id), 3)
    assert.lengthOf(storage.driver.puts, putsBefore)
  })

  test('un fichier illisible ne bloque pas le produit : l’original est gardé, aucune variante', async ({
    assert,
  }) => {
    const product = await createProduct([await uploadedFile('pas une image', 'jpg')])

    const images = await ProductImage.query().where('productId', product.id)
    assert.lengthOf(images, 1)
    assert.lengthOf(await ProductImageVariant.query(), 0)
    await product.refresh()
    assert.equal(product.imageUrl, images[0].secureUrl)

    const service = await app.container.make(ImageVariantService)
    await service.generate(images[0].id).then(
      () => assert.fail('la génération aurait dû échouer'),
      () => undefined
    )
  })

  test('une image disparue est ignorée', async ({ assert }) => {
    const service = await app.container.make(ImageVariantService)
    await service.generate(999_999)
    assert.lengthOf(await ProductImageVariant.query(), 0)
  })

  test('le transformer expose les variantes dans l’ordre carte, fiche, zoom', async ({
    assert,
  }) => {
    const product = await createProduct([await uploadedFile(await photo(1000, 500), 'jpg')])
    const image = await ProductImage.query()
      .where('productId', product.id)
      .preload('variants')
      .firstOrFail()

    const serialized = new ProductImageTransformer(image).toObject()
    assert.deepEqual(
      serialized.variants.map((variant) => variant.name),
      ['card', 'detail', 'zoom']
    )

    const bare = await ProductImage.findOrFail(image.id)
    assert.deepEqual(new ProductImageTransformer(bare).toObject().variants, [])
  })
})

test.group('Variantes d’image — zéro orphelin', (group) => {
  useDatabase(group, { seed: 'full' })
  const storage = useFakeStorage(group)

  test('retirer une image libère l’original et ses variantes', async ({ assert }) => {
    const product = await createProduct([await uploadedFile(await photo(1000, 500), 'jpg')])
    const image = await ProductImage.query().where('productId', product.id).firstOrFail()
    assert.equal(storage.driver.objects.size, 4)

    const category = await Category.findByOrFail('slug', 'sac')
    const service = await app.container.make(SupplierProductService)
    await service.update(product, input(category.id), [], [image.id])

    assert.lengthOf(await ProductImageVariant.query(), 0)
    assert.lengthOf(await StorageObject.query().where('status', 'ready'), 0)
    assert.equal(storage.driver.objects.size, 0)
  })

  test('supprimer un produit libère aussi les variantes', async ({ assert }) => {
    const product = await createProduct([await uploadedFile(await photo(1000, 500), 'jpg')])
    const service = await app.container.make(SupplierProductService)

    await service.delete(product)

    assert.lengthOf(await StorageObject.query().where('status', 'ready'), 0)
    assert.equal(storage.driver.objects.size, 0)
  })
})
