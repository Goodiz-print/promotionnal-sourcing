import { test } from '@japa/runner'
import { seededDevUser } from '#tests/utils/organizations'
import { OrganizationDocumentFactory } from '#database/factories/organization_document_factory'
import { ProductDocumentFactory } from '#database/factories/product_document_factory'
import { StorageObjectFactory } from '#database/factories/storage_object_factory'
import Organization from '#models/organization'
import Product from '#models/product'
import { useFakeStorage } from '#tests/utils/storage'
import { useDatabase } from '#tests/utils/setup'

test.group('Documents fournisseurs — pages', (group) => {
  useDatabase(group, { seed: 'full' })
  useFakeStorage(group)

  test('le profil liste les documents de l’organisation avec leur lien public', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const object = await StorageObjectFactory.merge({ mimeType: 'application/pdf' }).create()
    await OrganizationDocumentFactory.merge({
      organizationId: org.id,
      storageObjectId: object.id,
      kind: 'certificate',
      originalName: 'iso.pdf',
      sizeBytes: 1234,
    }).create()
    // Un document sans fichier (objet détaché) n'est pas exposé.
    await OrganizationDocumentFactory.merge({ organizationId: org.id }).create()

    const response = await client.get('/fr/supplier/profile').loginAs(user).withInertia()

    response.assertStatus(200)
    assert.deepEqual(response.inertiaProps.documents, [
      {
        id: response.inertiaProps.documents[0].id,
        kind: 'certificate',
        originalName: 'iso.pdf',
        sizeBytes: 1234,
        url: `https://cellar.test/test-bucket/${object.key}`,
      },
    ])
  })

  test('la fiche publique du fournisseur expose ses documents', async ({ client, assert }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const object = await StorageObjectFactory.create()
    await OrganizationDocumentFactory.merge({
      organizationId: org.id,
      storageObjectId: object.id,
      originalName: 'catalogue.pdf',
    }).create()

    const response = await client.get('/fr/suppliers/eurogoods').withInertia()

    response.assertStatus(200)
    const documents = response.inertiaProps.supplier.documents
    assert.lengthOf(documents, 1)
    assert.equal(documents[0].originalName, 'catalogue.pdf')
    assert.equal(documents[0].kind, 'catalogue')
    assert.equal(documents[0].url, `https://cellar.test/test-bucket/${object.key}`)
  })

  test('un fournisseur sans document expose une liste vide', async ({ client, assert }) => {
    const response = await client.get('/fr/suppliers/eurogoods').withInertia()

    assert.deepEqual(response.inertiaProps.supplier.documents, [])
  })

  test('la fiche produit publique et le formulaire d’édition exposent la fiche technique', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const product = await Product.query()
      .whereHas('supplier', (supplier) => supplier.where('organizationId', org.id))
      .where('isActive', true)
      .firstOrFail()
    const object = await StorageObjectFactory.create()
    await ProductDocumentFactory.merge({
      productId: product.id,
      storageObjectId: object.id,
      originalName: 'fiche.pdf',
    }).create()

    const publicPage = await client.get(`/fr/products/${product.slug}`).withInertia()
    publicPage.assertStatus(200)
    assert.lengthOf(publicPage.inertiaProps.product.documents, 1)
    assert.equal(publicPage.inertiaProps.product.documents[0].originalName, 'fiche.pdf')
    assert.equal(
      publicPage.inertiaProps.product.documents[0].url,
      `https://cellar.test/test-bucket/${object.key}`
    )

    const editPage = await client
      .get(`/fr/supplier/products/${product.id}/edit`)
      .loginAs(user)
      .withInertia()
    editPage.assertStatus(200)
    assert.lengthOf(editPage.inertiaProps.product.documents, 1)
    assert.equal(editPage.inertiaProps.product.documents[0].originalName, 'fiche.pdf')
  })
})
