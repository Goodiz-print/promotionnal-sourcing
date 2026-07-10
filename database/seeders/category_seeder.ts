import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'
import CategoryTranslation from '#models/category_translation'
import type { Locale } from '#shared/types/i18n'

type Text = { name: string; description: string }

type CategorySeed = {
  slug: string
  synonyms: string[]
  translations: Record<Locale, Text>
}

const CATEGORIES: CategorySeed[] = [
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
    for (const seed of CATEGORIES) {
      const category = await Category.updateOrCreate(
        { slug: seed.slug },
        { synonyms: seed.synonyms }
      )

      for (const locale of Object.keys(seed.translations) as Locale[]) {
        await CategoryTranslation.updateOrCreate(
          { categoryId: category.id, locale },
          seed.translations[locale]
        )
      }
    }
  }
}
