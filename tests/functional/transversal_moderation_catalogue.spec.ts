import { test } from '@japa/runner'
import Product from '#models/product'
import { UserFactory } from '#database/factories/user_factory'
import ModerationService from '#services/moderation_service'
import ProductCatalogueService from '#services/product_catalogue_service'
import { useDatabase } from '#tests/utils/setup'

test.group('Modération — effet sur le catalogue public', (group) => {
  useDatabase(group, { seed: 'full' })

  test('un produit rejeté disparaît de la fiche publique', async ({ assert }) => {
    const reviewer = await UserFactory.apply('platformAdmin').create()
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')
    const catalogue = new ProductCatalogueService()
    assert.isNotNull(await catalogue.findBySlug(product.slug))

    await new ModerationService().decide({
      targetType: 'product',
      targetId: product.id,
      status: 'rejected',
      decidedBy: reviewer,
      reason: 'Photos non conformes',
    })

    assert.isNull(await catalogue.findBySlug(product.slug))
  })

  test('une nouvelle approbation le remet en ligne, l’historique reste', async ({ assert }) => {
    const reviewer = await UserFactory.apply('platformAdmin').create()
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')
    const moderation = new ModerationService()
    await moderation.decide({
      targetType: 'product',
      targetId: product.id,
      status: 'rejected',
      decidedBy: reviewer,
    })

    await moderation.decide({
      targetType: 'product',
      targetId: product.id,
      status: 'approved',
      decidedBy: reviewer,
    })

    assert.isNotNull(await new ProductCatalogueService().findBySlug(product.slug))
    assert.lengthOf(await moderation.history('product', product.id), 2)
  })

  test('un produit sans décision reste visible', async ({ assert }) => {
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')

    assert.isNotNull(await new ProductCatalogueService().findBySlug(product.slug))
  })
})
