import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Supplier from '#models/supplier'
import Category from '#models/category'
import Attribute from '#models/attribute'
import AttributeValue from '#models/attribute_value'
import Product from '#models/product'

/**
 * Facettes d'un produit : { attributeSlug: valueSlug }.
 */
type Facets = Record<string, string>

type ProductSeed = {
  name: string
  slug: string
  supplier: string
  category: string
  priceMin: number
  priceMax: number
  minQuantity: number
  originCountry: string
  madeInEurope: boolean
  description: string
  facets: Facets
}

/**
 * Jeu de demonstration qui prouve le filtrage ET fiable :
 * `category=crayon ET color=blue` doit renvoyer uniquement les 2 crayons
 * bleus (Crayon HB Bleu, Crayon Aquarelle Bleu) — pas le crayon rouge,
 * pas le stylo bleu, pas le sac bleu.
 */
const PRODUCTS: ProductSeed[] = [
  {
    name: 'Crayon HB Bleu',
    slug: 'crayon-hb-bleu',
    supplier: 'eurogoods',
    category: 'crayon',
    priceMin: 0.35,
    priceMax: 0.9,
    minQuantity: 100,
    originCountry: 'FR',
    madeInEurope: true,
    description: 'Crayon graphite laque bleu, corps en bois certifie FSC',
    facets: { color: 'blue', material: 'wood' },
  },
  {
    name: 'Crayon Aquarelle Bleu',
    slug: 'crayon-aquarelle-bleu',
    supplier: 'nordic-promo',
    category: 'crayon',
    priceMin: 0.6,
    priceMax: 1.4,
    minQuantity: 50,
    originCountry: 'SE',
    madeInEurope: true,
    description: 'Crayon de couleur aquarellable bleu azur',
    facets: { color: 'blue', material: 'wood' },
  },
  {
    name: 'Crayon HB Rouge',
    slug: 'crayon-hb-rouge',
    supplier: 'eurogoods',
    category: 'crayon',
    priceMin: 0.35,
    priceMax: 0.9,
    minQuantity: 100,
    originCountry: 'FR',
    madeInEurope: true,
    description: 'Crayon graphite laque rouge, corps en bois certifie FSC',
    facets: { color: 'red', material: 'wood' },
  },
  {
    name: 'Stylo Bille Bleu',
    slug: 'stylo-bille-bleu',
    supplier: 'iberia-gifts',
    category: 'stylo',
    priceMin: 0.2,
    priceMax: 0.6,
    minQuantity: 250,
    originCountry: 'ES',
    madeInEurope: true,
    description: 'Stylo bille encre bleue, corps plastique recycle',
    facets: { color: 'blue', material: 'plastic' },
  },
  {
    name: 'Stylo Bille Noir',
    slug: 'stylo-bille-noir',
    supplier: 'iberia-gifts',
    category: 'stylo',
    priceMin: 0.2,
    priceMax: 0.6,
    minQuantity: 250,
    originCountry: 'ES',
    madeInEurope: true,
    description: 'Stylo bille encre noire, corps plastique recycle',
    facets: { color: 'black', material: 'plastic' },
  },
  {
    name: 'Sac Coton Bleu',
    slug: 'sac-coton-bleu',
    supplier: 'nordic-promo',
    category: 'sac',
    priceMin: 1.5,
    priceMax: 3.2,
    minQuantity: 30,
    originCountry: 'SE',
    madeInEurope: true,
    description: 'Tote bag coton bio bleu, 180g/m2',
    facets: { color: 'blue', material: 'cotton' },
  },
]

export default class ProductSeeder extends BaseSeeder {
  async run() {
    const suppliers = await Supplier.query().select('id', 'slug')
    const categories = await Category.query().select('id', 'slug')
    const attributes = await Attribute.query().select('id', 'slug')
    const values = await AttributeValue.query().select('id', 'slug', 'attributeId')

    const supplierBySlug = new Map(suppliers.map((s) => [s.slug, s.id]))
    const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]))
    const attributeBySlug = new Map(attributes.map((a) => [a.slug, a.id]))

    const resolveValueId = (attributeSlug: string, valueSlug: string): number | undefined => {
      const attributeId = attributeBySlug.get(attributeSlug)
      return values.find((v) => v.attributeId === attributeId && v.slug === valueSlug)?.id
    }

    for (const seed of PRODUCTS) {
      const supplierId = supplierBySlug.get(seed.supplier)
      const categoryId = categoryBySlug.get(seed.category)
      if (supplierId === undefined || categoryId === undefined) continue

      const product = await Product.updateOrCreate(
        { slug: seed.slug },
        {
          supplierId,
          categoryId,
          name: seed.name,
          reference: seed.slug.toUpperCase(),
          description: seed.description,
          priceMin: String(seed.priceMin),
          priceMax: String(seed.priceMax),
          currency: 'EUR',
          minQuantity: seed.minQuantity,
          originCountry: seed.originCountry,
          madeInEurope: seed.madeInEurope,
          isActive: true,
        }
      )

      // Rattache les facettes via le pivot product_attributes (avec attribute_id).
      const pivot: Record<number, { attribute_id: number }> = {}
      for (const [attributeSlug, valueSlug] of Object.entries(seed.facets)) {
        const attributeId = attributeBySlug.get(attributeSlug)
        const valueId = resolveValueId(attributeSlug, valueSlug)
        if (attributeId === undefined || valueId === undefined) continue
        pivot[valueId] = { attribute_id: attributeId }
      }
      await product.related('attributeValues').sync(pivot)
    }
  }
}
