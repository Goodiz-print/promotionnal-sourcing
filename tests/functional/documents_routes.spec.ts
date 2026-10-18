import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { seededDevUser } from '#tests/utils/organizations'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import OrganizationDocument from '#models/organization_document'
import ProductDocument from '#models/product_document'
import Product from '#models/product'
import Organization from '#models/organization'
import GhostscriptRunner from '#services/pdf/ghostscript_runner'
import { uploadedFile, useFakeStorage } from '#tests/utils/storage'
import { joinOrganization } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

const PDF = Buffer.from('%PDF-1.4\n% contenu de test\n%%EOF\n')

/** Pas de Ghostscript dans ces tests : le PDF est stocké tel quel. */
class UnavailableRunner extends GhostscriptRunner {
  async available() {
    return false
  }

  async compress(content: Buffer) {
    return content
  }
}

test.group('Routes des documents fournisseurs', (group) => {
  useDatabase(group, { seed: 'full' })
  useFakeStorage(group)

  group.each.setup(() => {
    app.container.swap(GhostscriptRunner, () => new UnavailableRunner())
    return () => app.container.restore(GhostscriptRunner)
  })

  test('le propriétaire ajoute un catalogue PDF au profil', async ({ client, assert }) => {
    const user = await seededDevUser('eurogoods-org')
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const file = await uploadedFile(PDF, 'pdf')

    const response = await client
      .post('/fr/supplier/profile/documents')
      .redirects(0)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .field('kind', 'catalogue')
      .file('file', file.tmpPath!, { contentType: 'application/pdf' })

    response.assertStatus(302)
    const documents = await OrganizationDocument.query().where('organizationId', org.id)
    assert.lengthOf(documents, 1)
    assert.equal(documents[0].kind, 'catalogue')
    assert.equal(documents[0].sizeBytes, PDF.length)
  })

  test('un fichier qui n’est pas un PDF est refusé, même avec l’extension .pdf', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const file = await uploadedFile(Buffer.from('<html>pas un pdf</html>'), 'pdf')

    const response = await client
      .post('/fr/supplier/profile/documents')
      .withCsrfToken()
      .loginAs(user)
      .field('kind', 'certificate')
      .file('file', file.tmpPath!, { contentType: 'application/pdf' })

    assert.notEqual(response.status(), 302)
    assert.lengthOf(await OrganizationDocument.query().where('organizationId', org.id), 0)
  })

  test('supprimer le document d’une autre organisation renvoie 404 et ne touche à rien', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const other = await OrganizationFactory.apply('supplier').create()
    const foreign = await OrganizationDocument.create({
      organizationId: other.id,
      kind: 'catalogue',
      originalName: 'autre.pdf',
      sizeBytes: 10,
      storageObjectId: null,
    })

    const response = await client
      .delete(`/fr/supplier/profile/documents/${foreign.id}`)
      .withCsrfToken()
      .loginAs(user)

    response.assertStatus(404)
    assert.isNotNull(await OrganizationDocument.find(foreign.id))
  })

  test('un membre simple ne peut pas téléverser de document', async ({ client, assert }) => {
    const member = await UserFactory.create()
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    await joinOrganization(member, org, 'member')
    const file = await uploadedFile(PDF, 'pdf')

    const response = await client
      .post('/fr/supplier/profile/documents')
      .withCsrfToken()
      .loginAs(member)
      .field('kind', 'other')
      .file('file', file.tmpPath!, { contentType: 'application/pdf' })

    assert.notEqual(response.status(), 302)
    assert.lengthOf(await OrganizationDocument.query().where('organizationId', org.id), 0)
  })

  test('une fiche technique est ajoutée puis retirée sur un produit du fournisseur', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const product = await Product.query()
      .whereHas('supplier', (supplier) => supplier.where('organizationId', org.id))
      .firstOrFail()
    const file = await uploadedFile(PDF, 'pdf')

    await client
      .post(`/fr/supplier/products/${product.id}/documents`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(user)
      .file('file', file.tmpPath!, { contentType: 'application/pdf' })
      .then((response) => response.assertStatus(302))
    const [sheet] = await ProductDocument.query().where('productId', product.id)
    assert.isDefined(sheet)

    await client
      .delete(`/fr/supplier/products/${product.id}/documents/${sheet.id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(user)
      .then((response) => response.assertStatus(302))

    assert.isNull(await ProductDocument.find(sheet.id))
  })
})
