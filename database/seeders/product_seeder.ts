import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import Supplier from '#models/supplier'
import Category from '#models/category'
import Attribute from '#models/attribute'
import AttributeValue from '#models/attribute_value'
import Product from '#models/product'
import ProductTranslation from '#models/product_translation'
import ProductOriginService from '#services/product_origin_service'
import type { ContentLocale } from '#shared/types/i18n'
import type { ProductLifecycleStatus } from '#shared/types/product'

/**
 * Facettes d'un produit : { attributeSlug: valueSlug }.
 */
type Facets = Record<string, string>

type Text = {
  name: string
  description: string
  keywords?: string[]
  marketingPoints?: string[]
}

type ProductSeed = {
  slug: string
  supplier: string
  category: string
  priceMin: number
  priceMax: number
  minQuantity: number
  originCountry: string
  madeInEurope: boolean
  facets: Facets
  translations: Record<ContentLocale, Text>
  // Identité/classification (écart 5), commercial (écart 7), médias (écart 8).
  brand?: string
  hsCode?: string
  lifecycleStatus?: ProductLifecycleStatus
  releasedAt?: string
  supplierCategoryRaw?: string
  leadTimeDays?: number
  rushService?: boolean
  rushLeadTimeDays?: number
  videoUrl?: string
}

/**
 * Jeu de demonstration qui prouve le filtrage ET fiable :
 * `category=crayon ET color=blue` doit renvoyer uniquement les 2 crayons
 * bleus (Crayon HB Bleu, Crayon Aquarelle Bleu) — pas le crayon rouge,
 * pas le stylo bleu, pas le sac bleu. Contenu bilingue FR/EN.
 */
const PRODUCTS: ProductSeed[] = [
  {
    slug: 'crayon-hb-bleu',
    supplier: 'eurogoods',
    category: 'crayon',
    priceMin: 0.35,
    priceMax: 0.9,
    minQuantity: 100,
    originCountry: 'FR',
    madeInEurope: true,
    facets: { color: 'blue', material: 'wood' },
    translations: {
      fr: {
        name: 'Crayon HB Bleu',
        description: 'Crayon graphite laque bleu, corps en bois certifie FSC',
      },
      en: {
        name: 'Blue HB Pencil',
        description: 'Blue-lacquered graphite pencil, FSC-certified wooden body',
      },
    },
  },
  {
    slug: 'crayon-aquarelle-bleu',
    supplier: 'nordic-promo',
    category: 'crayon',
    priceMin: 0.6,
    priceMax: 1.4,
    minQuantity: 50,
    originCountry: 'SE',
    madeInEurope: true,
    facets: { color: 'blue', material: 'wood' },
    translations: {
      fr: {
        name: 'Crayon Aquarelle Bleu',
        description: 'Crayon de couleur aquarellable bleu azur',
      },
      en: {
        name: 'Blue Watercolor Pencil',
        description: 'Watercolor colour pencil in azure blue',
      },
    },
  },
  {
    slug: 'crayon-hb-rouge',
    supplier: 'eurogoods',
    category: 'crayon',
    priceMin: 0.35,
    priceMax: 0.9,
    minQuantity: 100,
    originCountry: 'FR',
    madeInEurope: true,
    facets: { color: 'red', material: 'wood' },
    translations: {
      fr: {
        name: 'Crayon HB Rouge',
        description: 'Crayon graphite laque rouge, corps en bois certifie FSC',
      },
      en: {
        name: 'Red HB Pencil',
        description: 'Red-lacquered graphite pencil, FSC-certified wooden body',
      },
    },
  },
  {
    slug: 'stylo-bille-bleu',
    supplier: 'iberia-gifts',
    category: 'stylo',
    priceMin: 0.2,
    priceMax: 0.6,
    minQuantity: 250,
    originCountry: 'ES',
    madeInEurope: true,
    facets: { color: 'blue', material: 'plastic' },
    translations: {
      fr: {
        name: 'Stylo Bille Bleu',
        description: 'Stylo bille encre bleue, corps plastique recycle',
      },
      en: {
        name: 'Blue Ballpoint Pen',
        description: 'Blue-ink ballpoint pen, recycled plastic body',
      },
    },
  },
  {
    slug: 'stylo-bille-noir',
    supplier: 'iberia-gifts',
    category: 'stylo',
    priceMin: 0.2,
    priceMax: 0.6,
    minQuantity: 250,
    originCountry: 'ES',
    madeInEurope: true,
    facets: { color: 'black', material: 'plastic' },
    translations: {
      fr: {
        name: 'Stylo Bille Noir',
        description: 'Stylo bille encre noire, corps plastique recycle',
      },
      en: {
        name: 'Black Ballpoint Pen',
        description: 'Black-ink ballpoint pen, recycled plastic body',
      },
    },
  },
  {
    slug: 'sac-coton-bleu',
    supplier: 'nordic-promo',
    category: 'sac',
    priceMin: 1.5,
    priceMax: 3.2,
    minQuantity: 30,
    originCountry: 'SE',
    madeInEurope: true,
    facets: { color: 'blue', material: 'cotton' },
    translations: {
      fr: { name: 'Sac Coton Bleu', description: 'Tote bag coton bio bleu, 180g/m2' },
      en: { name: 'Blue Cotton Bag', description: 'Blue organic cotton tote bag, 180gsm' },
    },
  },
  // Démo de l'arbre N1 > N2 et des nouvelles facettes (couleur famille + nuance,
  // matière, attributs propres à la catégorie). Porte les attributs obligatoires
  // de « Casquettes » (cap-panels, cap-type) : la fiche est donc publiable.
  {
    slug: 'casquette-6-panneaux-marine',
    supplier: 'eurogoods',
    category: 'casquettes-chapeaux-casquettes',
    priceMin: 3.2,
    priceMax: 5.9,
    minQuantity: 50,
    originCountry: 'FR',
    madeInEurope: true,
    // Identité/classification, commercial, médias (ÉTAPE 2) : fiche de démo
    // complète pour valider les filtres « Nouveautés » et provenance bout en bout.
    brand: 'EuroCaps',
    hsCode: '650500',
    lifecycleStatus: 'new',
    releasedAt: DateTime.now().minus({ days: 15 }).toISODate()!,
    supplierCategoryRaw: 'Casquettes & bonnets',
    leadTimeDays: 21,
    rushService: true,
    rushLeadTimeDays: 7,
    videoUrl: 'https://videos.example/casquette-6-panneaux.mp4',
    facets: {
      'color': 'blue',
      'color-shade': 'bleu-marine',
      // Coton bio (coton brossé bio, cf. compositions « Casquettes » du classeur) :
      // valeur distincte de `cotton`, pour ne pas croiser le filtre bleu+coton.
      'material': 'organic-cotton',
      'cap-panels': '6',
      'cap-type': 'baseball',
      'cap-closure': 'metal-buckle',
    },
    translations: {
      fr: {
        name: 'Casquette 6 panneaux marine',
        description: 'Casquette baseball 6 panneaux en coton bio brossé, fermeture boucle métal',
        keywords: ['casquette', 'coton bio', 'baseball', 'marine'],
        marketingPoints: [
          'Coton biologique certifié',
          'Boucle métal réglable',
          'Marquage 6 positions',
        ],
      },
      en: {
        name: 'Navy 6-panel cap',
        description: 'Six-panel organic brushed-cotton baseball cap with metal buckle closure',
        keywords: ['cap', 'organic cotton', 'baseball', 'navy'],
        marketingPoints: [
          'Certified organic cotton',
          'Adjustable metal buckle',
          'Six marking positions',
        ],
      },
    },
  },
]

export default class ProductSeeder extends BaseSeeder {
  async run() {
    const origin = await app.container.make(ProductOriginService)
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
          reference: seed.slug.toUpperCase(),
          priceMin: String(seed.priceMin),
          priceMax: String(seed.priceMax),
          currency: 'EUR',
          minQuantity: seed.minQuantity,
          originCountry: seed.originCountry,
          madeInEurope: seed.madeInEurope,
          isActive: true,
          // Identité/classification (écart 5), commercial (écart 7), médias (écart 8).
          brand: seed.brand ?? null,
          hsCode: seed.hsCode ?? null,
          lifecycleStatus: seed.lifecycleStatus ?? 'active',
          releasedAt: seed.releasedAt ? DateTime.fromISO(seed.releasedAt) : null,
          supplierCategoryRaw: seed.supplierCategoryRaw ?? null,
          leadTimeDays: seed.leadTimeDays ?? null,
          rushService: seed.rushService ?? false,
          rushLeadTimeDays: seed.rushLeadTimeDays ?? null,
          videoUrl: seed.videoUrl ?? null,
          // Provenance dérivée (écart 9), jamais saisie.
          originZone: origin.deriveZone(seed.originCountry, seed.madeInEurope),
        }
      )

      for (const locale of Object.keys(seed.translations) as ContentLocale[]) {
        const text = seed.translations[locale]
        await ProductTranslation.updateOrCreate(
          { productId: product.id, locale },
          {
            name: text.name,
            description: text.description,
            keywords: text.keywords ?? null,
            marketingPoints: text.marketingPoints ?? null,
          }
        )
      }

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
