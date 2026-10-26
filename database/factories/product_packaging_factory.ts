import factory from '@adonisjs/lucid/factories'
import ProductPackaging from '#models/product_packaging'

/**
 * Conditionnement / logistique produit (écart 3), relation 1:1. `productId` est
 * à fournir par l'appelant. `outerCartonVolumeM3` reste une chaîne (décimal).
 */
export const ProductPackagingFactory = factory
  .define(ProductPackaging, ({ faker }) => ({
    packageType: faker.helpers.arrayElement(['Polybag', 'Boîte cadeau', 'Étui', 'Tube']),
    unitGrossWeightG: faker.number.int({ min: 10, max: 2000 }),
    innerCartonQty: faker.number.int({ min: 1, max: 50 }),
    outerCartonQty: faker.number.int({ min: 50, max: 500 }),
    outerCartonLengthMm: faker.number.int({ min: 100, max: 800 }),
    outerCartonWidthMm: faker.number.int({ min: 100, max: 800 }),
    outerCartonHeightMm: faker.number.int({ min: 100, max: 800 }),
    outerCartonGrossWeightG: faker.number.int({ min: 1000, max: 20000 }),
    outerCartonVolumeM3: faker.number.float({ min: 0.01, max: 0.5, fractionDigits: 4 }).toString(),
  }))
  .build()
