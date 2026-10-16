import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Attribute from '#models/attribute'
import AttributeValue from '#models/attribute_value'
import AttributeTranslation from '#models/attribute_translation'
import AttributeValueTranslation from '#models/attribute_value_translation'
import type { ContentLocale } from '#shared/types/i18n'

type ValueSeed = {
  value: string
  slug: string
  synonyms: string[]
  labels: Record<ContentLocale, string>
}

type AttributeSeed = {
  slug: string
  type: 'enum'
  names: Record<ContentLocale, string>
  values: ValueSeed[]
}

const ATTRIBUTES: AttributeSeed[] = [
  {
    slug: 'color',
    type: 'enum',
    names: { fr: 'Couleur', en: 'Color' },
    values: [
      {
        value: 'blue',
        slug: 'blue',
        synonyms: ['bleu', 'blue', 'azur'],
        labels: { fr: 'Bleu', en: 'Blue' },
      },
      { value: 'red', slug: 'red', synonyms: ['rouge', 'red'], labels: { fr: 'Rouge', en: 'Red' } },
      {
        value: 'black',
        slug: 'black',
        synonyms: ['noir', 'black'],
        labels: { fr: 'Noir', en: 'Black' },
      },
      {
        value: 'green',
        slug: 'green',
        synonyms: ['vert', 'green'],
        labels: { fr: 'Vert', en: 'Green' },
      },
    ],
  },
  {
    slug: 'material',
    type: 'enum',
    names: { fr: 'Matiere', en: 'Material' },
    values: [
      {
        value: 'wood',
        slug: 'wood',
        synonyms: ['bois', 'wood'],
        labels: { fr: 'Bois', en: 'Wood' },
      },
      {
        value: 'plastic',
        slug: 'plastic',
        synonyms: ['plastique', 'plastic'],
        labels: { fr: 'Plastique', en: 'Plastic' },
      },
      {
        value: 'cotton',
        slug: 'cotton',
        synonyms: ['coton', 'cotton'],
        labels: { fr: 'Coton', en: 'Cotton' },
      },
    ],
  },
]

export default class AttributeSeeder extends BaseSeeder {
  async run() {
    for (const attr of ATTRIBUTES) {
      const attribute = await Attribute.updateOrCreate(
        { slug: attr.slug },
        { type: attr.type, isFilterable: true }
      )

      for (const locale of Object.keys(attr.names) as ContentLocale[]) {
        await AttributeTranslation.updateOrCreate(
          { attributeId: attribute.id, locale },
          { name: attr.names[locale] }
        )
      }

      for (const value of attr.values) {
        const attributeValue = await AttributeValue.updateOrCreate(
          { attributeId: attribute.id, slug: value.slug },
          { value: value.value, synonyms: value.synonyms }
        )

        for (const locale of Object.keys(value.labels) as ContentLocale[]) {
          await AttributeValueTranslation.updateOrCreate(
            { attributeValueId: attributeValue.id, locale },
            { label: value.labels[locale] }
          )
        }
      }
    }
  }
}
