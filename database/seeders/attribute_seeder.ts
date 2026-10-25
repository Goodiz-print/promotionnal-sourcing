import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Attribute from '#models/attribute'
import AttributeValue from '#models/attribute_value'
import AttributeTranslation from '#models/attribute_translation'
import AttributeValueTranslation from '#models/attribute_value_translation'
import type { ContentLocale } from '#shared/types/i18n'
import type { AttributeDataType } from '#shared/types/attribute'
import { COLOR_FAMILIES, COLOR_SHADES } from '#database/data/catalogue/colors'
import { MATERIALS } from '#database/data/catalogue/materials'
import { FACET_ATTRIBUTES } from '#database/data/catalogue/category_attributes'

/**
 * Attributs du catalogue (écarts 1 & 6 du plan d'extension) :
 *
 * - **`color`** — couleur **famille** (N1), 14 valeurs + pastille `hex`. Les 4
 *   valeurs historiques (blue/red/black/green) restent, enrichies du hex ;
 * - **`color-shade`** — couleur **nuance** (N2), 26 valeurs + `hex`, chacune
 *   rattachée à sa famille par `parent_value_id` (couleur à 2 niveaux) ;
 * - **`material`** — matière (liste fermée), valeurs + synonymes d'import ;
 * - attributs propres aux catégories curées (`FACET_ATTRIBUTES`).
 *
 * Les libellés de familles sont bilingues (données du classeur) ; nuances,
 * matières et attributs par catégorie sont semés en FR (la langue source) et
 * retombent sur le FR en EN tant que la traduction n'est pas saisie.
 */
export default class AttributeSeeder extends BaseSeeder {
  async run() {
    await this.seedColorFamilies()
    await this.seedColorShades()
    await this.seedMaterials()
    await this.seedFacetAttributes()
  }

  private async upsertAttribute(
    slug: string,
    type: AttributeDataType,
    names: Partial<Record<ContentLocale, string>>,
    unit: string | null = null
  ): Promise<Attribute> {
    const attribute = await Attribute.updateOrCreate({ slug }, { type, unit, isFilterable: true })
    for (const locale of Object.keys(names) as ContentLocale[]) {
      await AttributeTranslation.updateOrCreate(
        { attributeId: attribute.id, locale },
        { name: names[locale]! }
      )
    }
    return attribute
  }

  private async upsertValue(
    attributeId: number,
    slug: string,
    value: string,
    labels: Partial<Record<ContentLocale, string>>,
    extra: { synonyms?: string[]; hex?: string | null; parentValueId?: number | null } = {}
  ): Promise<AttributeValue> {
    const attributeValue = await AttributeValue.updateOrCreate(
      { attributeId, slug },
      {
        value,
        synonyms: extra.synonyms ?? [],
        hex: extra.hex ?? null,
        parentValueId: extra.parentValueId ?? null,
      }
    )
    for (const locale of Object.keys(labels) as ContentLocale[]) {
      await AttributeValueTranslation.updateOrCreate(
        { attributeValueId: attributeValue.id, locale },
        { label: labels[locale]! }
      )
    }
    return attributeValue
  }

  private async seedColorFamilies() {
    const color = await this.upsertAttribute('color', 'enum', { fr: 'Couleur', en: 'Color' })
    for (const family of COLOR_FAMILIES) {
      await this.upsertValue(color.id, family.slug, family.slug, family.labels, {
        hex: family.hex,
        synonyms: [family.labels.fr.toLowerCase(), family.labels.en.toLowerCase()],
      })
    }
  }

  private async seedColorShades() {
    const color = await Attribute.findByOrFail('slug', 'color')
    const families = await AttributeValue.query()
      .where('attributeId', color.id)
      .select('id', 'slug')
    const familyIdBySlug = new Map(families.map((f) => [f.slug, f.id]))

    const shade = await this.upsertAttribute('color-shade', 'enum', {
      fr: 'Couleur — nuance',
      en: 'Colour — shade',
    })
    for (const s of COLOR_SHADES) {
      await this.upsertValue(
        shade.id,
        s.slug,
        s.slug,
        { fr: s.label },
        {
          hex: s.hex,
          synonyms: s.synonyms,
          parentValueId: familyIdBySlug.get(s.familySlug) ?? null,
        }
      )
    }
  }

  private async seedMaterials() {
    const material = await this.upsertAttribute('material', 'enum', {
      fr: 'Matière',
      en: 'Material',
    })
    for (const m of MATERIALS) {
      await this.upsertValue(material.id, m.slug, m.slug, { fr: m.label }, { synonyms: m.synonyms })
    }
  }

  private async seedFacetAttributes() {
    for (const def of FACET_ATTRIBUTES) {
      const attribute = await this.upsertAttribute(
        def.slug,
        def.type,
        { fr: def.name },
        def.unit ?? null
      )
      for (const value of def.values ?? []) {
        await this.upsertValue(attribute.id, value.slug, value.value, { fr: value.label })
      }
    }
  }
}
