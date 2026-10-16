import { test } from '@japa/runner'
import { OrganizationFactory } from '#database/factories/organization_factory'
import Organization from '#models/organization'
import Category from '#models/category'
import ProductImage from '#models/product_image'
import SupplierTranslation from '#models/supplier_translation'
import SupplierProductService from '#services/supplier_product_service'
import StorageObject from '#models/storage_object'
import app from '@adonisjs/core/services/app'
import { useDatabase } from '#tests/utils/setup'
import { uploadedFile, useFakeStorage } from '#tests/utils/storage'

function service() {
  return app.container.make(SupplierProductService)
}

const baseInput = (categoryId: number) => ({
  categoryId,
  sourceLocale: 'fr' as const,
  translations: {
    fr: { name: 'Sac Test', description: null },
    en: { name: 'Test Bag', description: null },
  },
  attributeValueIds: [] as number[],
})

test.group('SupplierProductService — galerie & fournisseur', (group) => {
  useDatabase(group, { seed: 'full' })
  const storage = useFakeStorage(group)

  test('create attache les images uploadées (positions) et fixe image_url', async ({ assert }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const category = await Category.findByOrFail('slug', 'sac')
    const svc = await service()
    const product = await svc.create(org, baseInput(category.id), [
      await uploadedFile('image-a', 'jpg'),
      await uploadedFile('image-b', 'jpg'),
    ])

    const images = await ProductImage.query().where('productId', product.id).orderBy('position')
    assert.lengthOf(images, 2)
    assert.equal(images[0].position, 0)
    assert.equal(images[1].position, 1)

    await product.refresh()
    assert.equal(product.imageUrl, images[0].secureUrl)
    assert.lengthOf(await StorageObject.query().where('status', 'ready'), 2)
    assert.equal(storage.driver.objects.size, 2)
  })

  test('update retire les images (pending_delete puis purge de l’objet) et ajoute les nouvelles', async ({
    assert,
  }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const category = await Category.findByOrFail('slug', 'sac')
    const svc = await service()

    const product = await svc.create(org, baseInput(category.id), [
      await uploadedFile('image-a', 'jpg'),
    ])
    const first = await ProductImage.query().where('productId', product.id).firstOrFail()

    const firstObject = await StorageObject.findOrFail(first.storageObjectId!)

    await svc.update(
      product,
      baseInput(category.id),
      [await uploadedFile('image-c', 'jpg')],
      [first.id]
    )

    assert.include(storage.driver.deletes, firstObject.key)
    assert.isFalse(storage.driver.objects.has(firstObject.key))
    assert.lengthOf(await StorageObject.query().where('status', 'pending_delete'), 0)
    const images = await ProductImage.query().where('productId', product.id).orderBy('position')
    assert.lengthOf(images, 1)
    assert.notInclude(
      images.map((i) => i.id),
      first.id
    )
    await product.refresh()
    assert.equal(product.imageUrl, images[0].secureUrl)
  })

  test('deux produits partagent l’objet d’une image identique ; le retirer d’un seul le conserve', async ({
    assert,
  }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const category = await Category.findByOrFail('slug', 'sac')
    const svc = await service()

    const first = await svc.create(org, baseInput(category.id), [await uploadedFile('meme', 'jpg')])
    const second = await svc.create(
      org,
      {
        ...baseInput(category.id),
        translations: {
          fr: { name: 'Autre sac', description: null },
          en: { name: 'Other bag', description: null },
        },
      },
      [await uploadedFile('meme', 'jpg')]
    )

    assert.lengthOf(await StorageObject.query(), 1)
    assert.lengthOf(storage.driver.puts, 1)

    const firstImage = await ProductImage.query().where('productId', first.id).firstOrFail()
    await svc.update(first, baseInput(category.id), [], [firstImage.id])

    assert.lengthOf(storage.driver.deletes, 0)
    assert.lengthOf(await ProductImage.query().where('productId', second.id), 1)
    assert.equal(storage.driver.objects.size, 1)
  })

  test('delete du produit libère ses objets de galerie', async ({ assert }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const category = await Category.findByOrFail('slug', 'sac')
    const svc = await service()

    const product = await svc.create(org, baseInput(category.id), [
      await uploadedFile('seul', 'jpg'),
    ])
    await svc.delete(product)

    assert.equal(storage.driver.objects.size, 0)
    assert.lengthOf(await StorageObject.query(), 0)
  })

  test('resolveSupplier crée le fournisseur si l’organisation n’en a pas', async ({ assert }) => {
    const org = await OrganizationFactory.apply('supplier')
      .merge({ name: 'New Supplier Co', country: 'BE' })
      .create()

    const svc = await service()
    const supplier = await svc.resolveSupplier(org)

    assert.equal(supplier.organizationId, org.id)
    assert.equal(supplier.country, 'BE')
    const translation = await SupplierTranslation.query()
      .where('supplierId', supplier.id)
      .where('locale', 'fr')
      .firstOrFail()
    assert.equal(translation.name, 'New Supplier Co')
  })
})
