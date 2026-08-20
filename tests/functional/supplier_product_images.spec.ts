import { test } from '@japa/runner'
import { OrganizationFactory } from '#database/factories/organization_factory'
import Organization from '#models/organization'
import Category from '#models/category'
import ProductImage from '#models/product_image'
import SupplierTranslation from '#models/supplier_translation'
import SupplierProductService from '#services/supplier_product_service'
import CloudinaryService, { type CloudinaryUploader } from '#services/cloudinary_service'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import { useDatabase } from '#tests/utils/setup'

function fakeFile(name: string): MultipartFile {
  return { tmpPath: `/tmp/${name}` } as unknown as MultipartFile
}

/**
 * Faux uploader Cloudinary : aucun appel réseau, enregistre les suppressions.
 */
function fakeUploader() {
  const destroyed: string[] = []
  const uploader: CloudinaryUploader = {
    async upload(file, options) {
      const filename = file.split('/').pop()
      return {
        secure_url: `https://cdn.test/${options.folder}/${filename}`,
        public_id: `${options.folder}/${filename}`,
        width: 800,
        height: 600,
      } as Awaited<ReturnType<CloudinaryUploader['upload']>>
    },
    async destroy(publicId) {
      destroyed.push(publicId)
      return { result: 'ok' }
    },
  }
  return { uploader, destroyed }
}

function service(uploader: CloudinaryUploader) {
  return new SupplierProductService(new CloudinaryService(uploader))
}

const baseInput = (categoryId: number) => ({
  categoryId,
  translations: {
    fr: { name: 'Sac Test', description: null },
    en: { name: 'Test Bag', description: null },
  },
  attributeValueIds: [] as number[],
})

test.group('SupplierProductService — galerie & fournisseur', (group) => {
  useDatabase(group, { seed: 'full' })

  test('create attache les images uploadées (positions) et fixe image_url', async ({ assert }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const category = await Category.findByOrFail('slug', 'sac')
    const { uploader } = fakeUploader()

    const product = await service(uploader).create(org, baseInput(category.id), [
      fakeFile('a.jpg'),
      fakeFile('b.jpg'),
    ])

    const images = await ProductImage.query().where('productId', product.id).orderBy('position')
    assert.lengthOf(images, 2)
    assert.equal(images[0].position, 0)
    assert.equal(images[1].position, 1)

    await product.refresh()
    assert.equal(product.imageUrl, images[0].secureUrl)
  })

  test('update supprime les images retirées (destroyMany) et ajoute les nouvelles', async ({
    assert,
  }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const category = await Category.findByOrFail('slug', 'sac')
    const { uploader, destroyed } = fakeUploader()
    const svc = service(uploader)

    const product = await svc.create(org, baseInput(category.id), [fakeFile('a.jpg')])
    const first = await ProductImage.query().where('productId', product.id).firstOrFail()

    await svc.update(product, baseInput(category.id), [fakeFile('c.jpg')], [first.id])

    assert.include(destroyed, first.publicId)
    const images = await ProductImage.query().where('productId', product.id).orderBy('position')
    assert.lengthOf(images, 1)
    assert.notInclude(
      images.map((i) => i.id),
      first.id
    )
    await product.refresh()
    assert.equal(product.imageUrl, images[0].secureUrl)
  })

  test('resolveSupplier crée le fournisseur si l’organisation n’en a pas', async ({ assert }) => {
    const org = await OrganizationFactory.apply('supplier')
      .merge({ name: 'New Supplier Co', country: 'BE' })
      .create()

    const supplier = await service(fakeUploader().uploader).resolveSupplier(org)

    assert.equal(supplier.organizationId, org.id)
    assert.equal(supplier.country, 'BE')
    const translation = await SupplierTranslation.query()
      .where('supplierId', supplier.id)
      .where('locale', 'fr')
      .firstOrFail()
    assert.equal(translation.name, 'New Supplier Co')
  })
})
