import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'
import CategoryTranslation from '#models/category_translation'
import { CATEGORY_TREE, type CategorySeed } from '#database/data/catalogue/categories'

/**
 * Référentiel : arbre N1 > N2 des catégories du classeur Virgile, semé dans tous
 * les environnements (`ReferenceSeeder`). Les catégories de démo (`crayon`,
 * `stylo`, `sac`) sont dans `DemoCategorySeeder`.
 */
export default class CategorySeeder extends BaseSeeder {
  async run() {
    // Les N1 d'abord : chaque N2 a besoin de l'id de son parent.
    const roots = await Promise.all(
      CATEGORY_TREE.filter((seed) => seed.parentSlug === null).map((seed) =>
        this.seedCategory(seed, null)
      )
    )
    const idBySlug = new Map(roots.map((category) => [category.slug, category.id]))

    await Promise.all(
      CATEGORY_TREE.filter((seed) => seed.parentSlug !== null).map((seed) =>
        this.seedCategory(seed, idBySlug.get(seed.parentSlug ?? '') ?? null)
      )
    )
  }

  /** Une catégorie et son libellé en langue source (FR ; l'EN retombe sur le FR). */
  private async seedCategory(seed: CategorySeed, parentId: number | null): Promise<Category> {
    const category = await Category.updateOrCreate(
      { slug: seed.slug },
      { synonyms: seed.synonyms, parentId }
    )
    await CategoryTranslation.updateOrCreate(
      { categoryId: category.id, locale: 'fr' },
      { name: seed.name, description: null }
    )
    return category
  }
}
