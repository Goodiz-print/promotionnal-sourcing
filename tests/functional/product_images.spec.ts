import { test } from '@japa/runner'
import Product from '#models/product'
import ProductImage from '#models/product_image'
import { useDatabase } from '#tests/utils/setup'

test.group("Catalogue — galerie d'images produit", (group) => {
  useDatabase(group, { seed: 'full', perTest: false })

  test('la fiche expose les images de la galerie triées par position', async ({
    client,
    assert,
  }) => {
    const product = await Product.findByOrFail('slug', 'crayon-aquarelle-bleu')
    await ProductImage.createMany([
      {
        productId: product.id,
        secureUrl: 'https://img.example/second.jpg',
        publicId: 'promotionnal-sourcing/test/products/crayon-aquarelle-bleu/second',
        position: 1,
        width: 800,
        height: 600,
      },
      {
        productId: product.id,
        secureUrl: 'https://img.example/first.jpg',
        publicId: 'promotionnal-sourcing/test/products/crayon-aquarelle-bleu/first',
        position: 0,
        width: 800,
        height: 600,
      },
    ])

    const response = await client.get('/fr/products/crayon-aquarelle-bleu').withInertia()

    response.assertStatus(200)
    const images = response.inertiaProps.product.images
    assert.lengthOf(images, 2)
    assert.equal(images[0].position, 0)
    assert.equal(images[0].url, 'https://img.example/first.jpg')
    assert.equal(images[1].url, 'https://img.example/second.jpg')
  })

  test('sans image la galerie est un tableau vide', async ({ client, assert }) => {
    const response = await client.get('/fr/products/crayon-hb-bleu').withInertia()

    response.assertStatus(200)
    assert.isArray(response.inertiaProps.product.images)
    assert.lengthOf(response.inertiaProps.product.images, 0)
  })
})
