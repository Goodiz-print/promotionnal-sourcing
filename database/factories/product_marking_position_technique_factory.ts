import factory from '@adonisjs/lucid/factories'
import ProductMarkingPositionTechnique from '#models/product_marking_position_technique'

/**
 * Technique possible sur une position de marquage (écart 2). `markingPositionId`
 * et `markingTechniqueId` sont à fournir par l'appelant. `defaultSetupCharge`
 * reste une chaîne (décimal).
 */
export const ProductMarkingPositionTechniqueFactory = factory
  .define(ProductMarkingPositionTechnique, ({ faker }) => ({
    maxColors: faker.number.int({ min: 1, max: 8 }),
    defaultSetupCharge: faker.number.float({ min: 10, max: 60, fractionDigits: 2 }).toString(),
  }))
  .build()
