import { test } from '@japa/runner'
import Organization from '#models/organization'
import Supplier from '#models/supplier'
import OrganizationTransformer from '#transformers/organization_transformer'
import { useDatabase } from '#tests/utils/setup'

test.group('Organisation — type acheteur/fournisseur + réconciliation suppliers', (group) => {
  // Sème via MainSeeder (ordre des dépendances) plutôt que `db:seed`, comme
  // pour le catalogue.
  useDatabase(group, { seed: 'full', perTest: false })

  test("l'organisation de démo est de type acheteur", async ({ assert }) => {
    const org = await Organization.findByOrFail('slug', 'promotionnal-sourcing')
    assert.equal(org.organizationType, 'buyer')
  })

  test("l'organisation fournisseur porte un profil détaillé", async ({ assert }) => {
    const org = await Organization.query()
      .where('slug', 'eurogoods-org')
      .preload('supplierProfile')
      .firstOrFail()

    assert.equal(org.organizationType, 'supplier')
    assert.isNotNull(org.supplierProfile)
    assert.equal(org.supplierProfile.deliveryScope, 'europe')
    assert.equal(org.supplierProfile.minOrderQuantity, 50)
    assert.deepEqual(org.supplierProfile.certifications, ['ISO 9001', 'FSC'])
  })

  test('la fiche catalogue eurogoods est rattachée à son organisation fournisseur', async ({
    assert,
  }) => {
    const supplierOrg = await Organization.findByOrFail('slug', 'eurogoods-org')

    const supplier = await Supplier.query()
      .where('slug', 'eurogoods')
      .preload('organization')
      .firstOrFail()

    assert.equal(supplier.organizationId, supplierOrg.id)
    assert.equal(supplier.organization.slug, 'eurogoods-org')
  })

  test('une organisation fournisseur expose ses fiches via hasMany(suppliers)', async ({
    assert,
  }) => {
    const org = await Organization.query()
      .where('slug', 'eurogoods-org')
      .preload('suppliers')
      .firstOrFail()

    assert.deepEqual(
      org.suppliers.map((s) => s.slug),
      ['eurogoods']
    )
  })

  test('OrganizationTransformer expose organizationType', async ({ assert }) => {
    const org = await Organization.findByOrFail('slug', 'eurogoods-org')
    const dto = new OrganizationTransformer(org).toObject()

    assert.equal(dto.organizationType, 'supplier')
  })
})
