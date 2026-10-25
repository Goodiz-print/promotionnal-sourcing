import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'
import Attribute from '#models/attribute'
import CategoryAttribute from '#models/category_attribute'
import CategoryAttributeRange from '#models/category_attribute_range'
import { CATEGORY_ATTRIBUTE_LINKS } from '#database/data/catalogue/category_attributes'

/**
 * Rattache les attributs aux catégories (pivot `category_attributes`) et sème
 * les tranches de filtre (`category_attribute_ranges`) — écarts 1 & 6 du plan.
 *
 * Dépend de `CategorySeeder` et `AttributeSeeder` (joués avant via
 * `MainSeeder`). Les lignes dont la catégorie ou l'attribut est introuvable
 * sont ignorées : le seeder reste donc sans effet néfaste si l'ordre n'est pas
 * respecté (ex. `node ace db:seed` qui joue les seeders par ordre alphabétique).
 */
export default class CategoryAttributeSeeder extends BaseSeeder {
  async run() {
    const categories = await Category.query().select('id', 'slug')
    const attributes = await Attribute.query().select('id', 'slug')
    const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]))
    const attributeIdBySlug = new Map(attributes.map((a) => [a.slug, a.id]))

    for (const link of CATEGORY_ATTRIBUTE_LINKS) {
      const categoryId = categoryIdBySlug.get(link.categorySlug)
      const attributeId = attributeIdBySlug.get(link.attributeSlug)
      if (categoryId === undefined || attributeId === undefined) continue

      const pivot = await CategoryAttribute.updateOrCreate(
        { categoryId, attributeId },
        {
          isRequiredForPublication: link.isRequiredForPublication ?? false,
          isFilter: link.isFilter ?? false,
          position: link.position,
        }
      )

      // Les tranches sont réécrites à chaque passage (idempotent) : on repart
      // de zéro pour ce pivot avant de réinsérer, dans l'ordre déclaré.
      await CategoryAttributeRange.query().where('categoryAttributeId', pivot.id).delete()
      let position = 0
      for (const range of link.ranges ?? []) {
        await CategoryAttributeRange.create({
          categoryAttributeId: pivot.id,
          minValue: range.minValue === null ? null : String(range.minValue),
          maxValue: range.maxValue === null ? null : String(range.maxValue),
          position: position++,
        })
      }
    }
  }
}
