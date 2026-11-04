import factory from '@adonisjs/lucid/factories'
import CategoryAttribute from '#models/category_attribute'

/**
 * Pivot catégorie-attribut de test (#165). `categoryId` et `attributeId` sont
 * à fournir par l'appelant (`.merge({ categoryId, attributeId })`).
 */
export const CategoryAttributeFactory = factory
  .define(CategoryAttribute, ({ faker }) => ({
    isRequiredForPublication: faker.datatype.boolean(),
    isFilter: faker.datatype.boolean(),
    position: faker.number.int({ min: 0, max: 100 }),
  }))
  .build()
