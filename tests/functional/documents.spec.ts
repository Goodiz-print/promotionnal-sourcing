import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { OrganizationFactory } from '#database/factories/organization_factory'
import Product from '#models/product'
import OrganizationDocument from '#models/organization_document'
import ProductDocument from '#models/product_document'
import DocumentService from '#services/document_service'
import GhostscriptRunner from '#services/pdf/ghostscript_runner'
import { uploadedFile, useFakeStorage } from '#tests/utils/storage'
import { useDatabase } from '#tests/utils/setup'

/** Compresseur factice : divise la taille, ou ne fait rien si `available` est faux. */
class HalvingRunner extends GhostscriptRunner {
  constructor(private isAvailable = true) {
    super()
  }

  async available() {
    return this.isAvailable
  }

  async compress(content: Buffer) {
    return content.subarray(0, Math.ceil(content.length / 2))
  }
}

const documents = () => app.container.make(DocumentService)

/** Contenu commençant par l'en-tête PDF, de la taille demandée. */
const pdfBuffer = (size: number) =>
  Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(size - 9, 'p')])

test.group('Documents PDF des fournisseurs', (group) => {
  useDatabase(group, { seed: 'full' })
  const storage = useFakeStorage(group)

  let runner: HalvingRunner
  group.each.setup(() => {
    runner = new HalvingRunner()
    app.container.swap(GhostscriptRunner, () => runner)
    return () => app.container.restore(GhostscriptRunner)
  })

  test('un catalogue est compressé, stocké en application/pdf et rattaché à l’organisation', async ({
    assert,
  }) => {
    const organization = await OrganizationFactory.apply('supplier').create()
    const file = await uploadedFile(pdfBuffer(1000), 'pdf')

    const service = await documents()
    const document = await service.addToOrganization(organization, file, 'catalogue')

    assert.equal(document.kind, 'catalogue')
    assert.equal(document.sizeBytes, 500)
    assert.equal(document.originalName, 'upload.pdf')
    const stored = [...storage.driver.objects.values()]
    assert.lengthOf(stored, 1)
    assert.equal(stored[0].mimeType, 'application/pdf')
    assert.equal(stored[0].content.length, 500)
  })

  test('sans Ghostscript, le PDF est stocké tel quel', async ({ assert }) => {
    runner = new HalvingRunner(false)
    const organization = await OrganizationFactory.apply('supplier').create()
    const file = await uploadedFile(pdfBuffer(1000), 'pdf')

    const service = await documents()
    const document = await service.addToOrganization(organization, file, 'certificate')

    assert.equal(document.sizeBytes, 1000)
  })

  test('deux fois le même PDF ne stocke qu’un seul objet', async ({ assert }) => {
    const organization = await OrganizationFactory.apply('supplier').create()
    const service = await documents()

    await service.addToOrganization(
      organization,
      await uploadedFile(pdfBuffer(800), 'pdf'),
      'other'
    )
    await service.addToOrganization(
      organization,
      await uploadedFile(pdfBuffer(800), 'pdf'),
      'other'
    )

    assert.lengthOf(storage.driver.puts, 1)
  })

  test('retirer un document supprime la ligne et purge le fichier', async ({ assert }) => {
    const organization = await OrganizationFactory.apply('supplier').create()
    const service = await documents()
    const document = await service.addToOrganization(
      organization,
      await uploadedFile(pdfBuffer(600), 'pdf'),
      'catalogue'
    )
    const key = [...storage.driver.objects.keys()][0]

    await service.removeOrganizationDocument(document)

    assert.isNull(await OrganizationDocument.find(document.id))
    assert.include(storage.driver.deletes, key)
  })

  test('une fiche technique suit le même cycle, rattachée au produit', async ({ assert }) => {
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')
    const service = await documents()

    const sheet = await service.addToProduct(product, await uploadedFile(pdfBuffer(900), 'pdf'))
    assert.equal(sheet.productId, product.id)
    assert.isNotNull(await ProductDocument.find(sheet.id))

    await service.removeProductDocument(sheet)
    assert.isNull(await ProductDocument.find(sheet.id))
  })
})
