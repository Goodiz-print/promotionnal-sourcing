import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'
import CategoryTranslation from '#models/category_translation'
import type { ContentLocale } from '#shared/types/i18n'
import { CATEGORY_TREE } from '#database/data/catalogue/categories'

type Text = { name: string; description: string }

type CategorySeed = {
  slug: string
  synonyms: string[]
  translations: Record<ContentLocale, Text>
}

/**
 * Catégories de démonstration historiques (top-level), conservées pour le jeu
 * de preuve du filtrage ET (crayon bleu…). L'arbre complet N1 > N2 du classeur
 * Virgile est semé en plus, ci-dessous.
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

export default class CategorySeeder extends BaseSeeder {
  async run() {
    for (const seed of DEMO_CATEGORIES) {
      const category = await Category.updateOrCreate(
        { slug: seed.slug },
        { synonyms: seed.synonyms }
      )
      for (const locale of Object.keys(seed.translations) as ContentLocale[]) {
        await CategoryTranslation.updateOrCreate(
          { categoryId: category.id, locale },
          seed.translations[locale]
        )
      }
    }

    // Arbre N1 > N2 du classeur. Les N1 (parentSlug null) viennent avant les N2
    // dans CATEGORY_TREE : le parent existe donc quand on résout le N2.
    const idBySlug = new Map<string, number>()
    for (const seed of CATEGORY_TREE) {
      const parentId = seed.parentSlug ? (idBySlug.get(seed.parentSlug) ?? null) : null
      const category = await Category.updateOrCreate(
        { slug: seed.slug },
        { synonyms: seed.synonyms, parentId }
      )
      idBySlug.set(seed.slug, category.id)
      // Contenu en langue source (FR) ; l'EN retombe sur le FR.
      await CategoryTranslation.updateOrCreate(
        { categoryId: category.id, locale: 'fr' },
        { name: seed.name, description: null }
      )
    }
  }
}
