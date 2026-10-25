import { test } from '@japa/runner'
import { useDatabase } from '#tests/utils/setup'

test.group('Annuaire public fournisseurs', (group) => {
  useDatabase(group, { seed: 'full', perTest: false })

  test("l'annuaire liste les fournisseurs actifs", async ({ client, assert }) => {
    const response = await client.get('/fr/suppliers').withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('suppliers/index')
    assert.lengthOf(response.inertiaProps.suppliers.data, 3)
    assert.equal(response.inertiaProps.suppliers.meta.currentPage, 1)
  })

  test('le filtre pays restreint la liste', async ({ client, assert }) => {
    const response = await client.get('/fr/suppliers').qs({ country: 'SE' }).withInertia()

    response.assertStatus(200)
    assert.lengthOf(response.inertiaProps.suppliers.data, 1)
    assert.equal(response.inertiaProps.suppliers.data[0].slug, 'nordic-promo')
  })

  test('la recherche filtre par nom localisé', async ({ client, assert }) => {
    const response = await client.get('/fr/suppliers').qs({ search: 'nordic' }).withInertia()

    response.assertStatus(200)
    assert.lengthOf(response.inertiaProps.suppliers.data, 1)
    assert.equal(response.inertiaProps.suppliers.data[0].slug, 'nordic-promo')
  })

  test('la fiche expose profil et catalogue pour un fournisseur lié', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/fr/suppliers/eurogoods').withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('suppliers/show')
    const supplier = response.inertiaProps.supplier
    assert.equal(supplier.slug, 'eurogoods')
    assert.equal(supplier.name, 'EuroGoods')
    assert.isNotNull(supplier.supplierProfile)
    assert.equal(supplier.supplierProfile.deliveryScope, 'europe')
    // eurogoods porte 3 fiches de démo : 2 crayons + la casquette (arbre N1>N2).
    assert.lengthOf(supplier.products, 3)
  })

  test('un fournisseur non rattaché à une organisation a un profil null', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/fr/suppliers/nordic-promo').withInertia()

    response.assertStatus(200)
    assert.isNull(response.inertiaProps.supplier.supplierProfile)
  })

  test('une fiche inconnue renvoie 404', async ({ client }) => {
    const response = await client.get('/fr/suppliers/inconnu').withInertia()
    response.assertStatus(404)
  })

  test('le contenu est localisé selon la locale (EN)', async ({ client, assert }) => {
    const response = await client.get('/en/suppliers/eurogoods').withInertia()

    response.assertStatus(200)
    assert.equal(response.inertiaProps.supplier.description, 'French promotional products supplier')
  })
})
