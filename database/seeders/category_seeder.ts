import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'

export default class CategorySeeder extends BaseSeeder {
  async run() {
    await Category.updateOrCreateMany('slug', [
      {
        name: 'Crayon',
        slug: 'crayon',
        description: 'Crayons a papier et de couleur',
        synonyms: ['crayon', 'crayons', 'pencil', 'pencils'],
      },
      {
        name: 'Stylo',
        slug: 'stylo',
        description: 'Stylos bille, roller et plume',
        synonyms: ['stylo', 'stylos', 'pen', 'pens'],
      },
      {
        name: 'Sac',
        slug: 'sac',
        description: 'Sacs shopping, tote bags et pochettes',
        synonyms: ['sac', 'sacs', 'bag', 'bags', 'tote'],
      },
    ])
  }
}
