import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'
import CategoryTranslation from '#models/category_translation'
import type { SeedLocale } from '#database/seed_locale'

type Text = { name: string; description: string }

type CategorySeed = {
  slug: string
  synonyms: string[]
  translations: Record<SeedLocale, Text>
}

/**
 * Catégories de démonstration historiques (top-level), conservées pour le jeu
 * de preuve du filtrage ET (crayon bleu…). Données de **démo** : jamais en
 * production. L'arbre du classeur Virgile (référentiel) est dans `CategorySeeder`.
 */
const DEMO_CATEGORIES: CategorySeed[] = [
  {
    slug: 'crayon',
    synonyms: ['crayon', 'crayons', 'pencil', 'pencils'],
    translations: {
      fr: { name: 'Crayon', description: 'Crayons a papier et de couleur' },
      en: { name: 'Pencil', description: 'Graphite and colour pencils' },
    },
  },
  {
    slug: 'stylo',
    synonyms: ['stylo', 'stylos', 'pen', 'pens'],
    translations: {
      fr: { name: 'Stylo', description: 'Stylos bille, roller et plume' },
      en: { name: 'Pen', description: 'Ballpoint, rollerball and fountain pens' },
    },
  },
  {
    slug: 'sac',
    synonyms: ['sac', 'sacs', 'bag', 'bags', 'tote'],
    translations: {
      fr: { name: 'Sac', description: 'Sacs shopping, tote bags et pochettes' },
      en: { name: 'Bag', description: 'Shopping bags, tote bags and pouches' },
    },
  },
]

export default class DemoCategorySeeder extends BaseSeeder {
  /** Catégories indépendantes les unes des autres : écrites en parallèle. */
  async run() {
    await Promise.all(DEMO_CATEGORIES.map((seed) => this.seedCategory(seed)))
  }

  private async seedCategory(seed: CategorySeed): Promise<void> {
    const category = await Category.updateOrCreate({ slug: seed.slug }, { synonyms: seed.synonyms })
    const locales = Object.keys(seed.translations) as SeedLocale[]
    await Promise.all(
      locales.map((locale) =>
        CategoryTranslation.updateOrCreate(
          { categoryId: category.id, locale },
          seed.translations[locale]
        )
      )
    )
  }
}
