import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Attribute from '#models/attribute'
import AttributeValue from '#models/attribute_value'

type ValueSeed = { value: string; label: string; slug: string; synonyms: string[] }

const ATTRIBUTES: Array<{
  name: string
  slug: string
  type: 'enum'
  values: ValueSeed[]
}> = [
  {
    name: 'Couleur',
    slug: 'color',
    type: 'enum',
    values: [
      { value: 'blue', label: 'Bleu', slug: 'blue', synonyms: ['bleu', 'blue', 'azur'] },
      { value: 'red', label: 'Rouge', slug: 'red', synonyms: ['rouge', 'red'] },
      { value: 'black', label: 'Noir', slug: 'black', synonyms: ['noir', 'black'] },
      { value: 'green', label: 'Vert', slug: 'green', synonyms: ['vert', 'green'] },
    ],
  },
  {
    name: 'Matiere',
    slug: 'material',
    type: 'enum',
    values: [
      { value: 'wood', label: 'Bois', slug: 'wood', synonyms: ['bois', 'wood'] },
      { value: 'plastic', label: 'Plastique', slug: 'plastic', synonyms: ['plastique', 'plastic'] },
      { value: 'cotton', label: 'Coton', slug: 'cotton', synonyms: ['coton', 'cotton'] },
    ],
  },
]

export default class AttributeSeeder extends BaseSeeder {
  async run() {
    for (const attr of ATTRIBUTES) {
      const attribute = await Attribute.updateOrCreate(
        { slug: attr.slug },
        { name: attr.name, type: attr.type, isFilterable: true }
      )

      for (const value of attr.values) {
        await AttributeValue.updateOrCreate(
          { attributeId: attribute.id, slug: value.slug },
          {
            value: value.value,
            label: value.label,
            synonyms: value.synonyms,
          }
        )
      }
    }
  }
}
