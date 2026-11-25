import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import Supplier from '#models/supplier'
import Category from '#models/category'
import Attribute from '#models/attribute'
import AttributeValue from '#models/attribute_value'
import Certification from '#models/certification'
import MarkingTechnique from '#models/marking_technique'
import Product from '#models/product'
import ProductTranslation from '#models/product_translation'
import ProductPackaging from '#models/product_packaging'
import ProductMarkingPosition from '#models/product_marking_position'
import ProductMarkingPositionTechnique from '#models/product_marking_position_technique'
import ProductMarkingPriceTier from '#models/product_marking_price_tier'
import ProductPriceTier from '#models/product_price_tier'
import ProductOriginService from '#services/product_origin_service'
import ProductEcoService from '#services/product_eco_service'
import { MATERIAL_ATTRIBUTE_SLUG } from '#shared/types/certification'
import type { SeedLocale } from '#database/seed_locale'
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
  translations: Record<SeedLocale, Text>
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
  // Conformité (écart 4) : labels (slugs), part de recyclé, mise en garde.
  certifications?: string[]
  recycledContentPercent?: number
  cautionComment?: string
  // Conditionnement / logistique (écart 3) : bloc 1:1 optionnel.
  packaging?: {
    packageType?: string
    unitGrossWeightG?: number
    innerCartonQty?: number
    outerCartonQty?: number
    outerCartonLengthMm?: number
    outerCartonWidthMm?: number
    outerCartonHeightMm?: number
    outerCartonGrossWeightG?: number
    outerCartonVolumeM3?: number
  }
  // Marquage structuré (écart 2) : produit personnalisable, positions (avec
  // techniques par slug) et grille de prix de marquage par technique/quantité.
  printable?: boolean
  markingPositions?: {
    name: string
    maxWidthMm?: number
    maxHeightMm?: number
    techniques: { technique: string; maxColors?: number; defaultSetupCharge?: number }[]
  }[]
  markingPriceTiers?: { technique: string; minQuantity: number; unitPrice: number }[]
  // Grille de prix dégressive du produit (paliers `variantId` null), lue par le
  // panier de devis pour le prix indicatif. Absente = produit « sans prix ».
  priceTiers?: { minQuantity: number; unitPrice: number }[]
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
    priceTiers: [
      { minQuantity: 100, unitPrice: 0.9 },
      { minQuantity: 500, unitPrice: 0.6 },
      { minQuantity: 1000, unitPrice: 0.45 },
      { minQuantity: 5000, unitPrice: 0.35 },
    ],
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
    priceTiers: [
      { minQuantity: 50, unitPrice: 1.4 },
      { minQuantity: 250, unitPrice: 1.0 },
      { minQuantity: 1000, unitPrice: 0.6 },
    ],
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
    priceTiers: [
      { minQuantity: 250, unitPrice: 0.6 },
      { minQuantity: 1000, unitPrice: 0.35 },
      { minQuantity: 5000, unitPrice: 0.2 },
    ],
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
    priceTiers: [
      { minQuantity: 30, unitPrice: 3.2 },
      { minQuantity: 100, unitPrice: 2.4 },
      { minQuantity: 500, unitPrice: 1.5 },
    ],
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
    priceTiers: [
      { minQuantity: 50, unitPrice: 5.9 },
      { minQuantity: 250, unitPrice: 4.5 },
      { minQuantity: 500, unitPrice: 3.2 },
    ],
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
    // Conformité (écart 4) : label GOTS (éco) + part de recyclé → la fiche est
    // « Éco-responsable » bout en bout (matière bio, label éco ET recyclé).
    certifications: ['gots', 'oeko-tex-standard-100'],
    recycledContentPercent: 35,
    cautionComment: 'Lavage à 30 °C maximum, ne pas repasser la visière.',
    // Conditionnement / logistique (écart 3) : fiche de démo complète.
    packaging: {
      packageType: 'Polybag',
      unitGrossWeightG: 95,
      innerCartonQty: 25,
      outerCartonQty: 100,
      outerCartonLengthMm: 600,
      outerCartonWidthMm: 400,
      outerCartonHeightMm: 350,
      outerCartonGrossWeightG: 11500,
      outerCartonVolumeM3: 0.084,
    },
    // Marquage structuré (écart 2) : 3 positions, techniques possibles et grille
    // de prix de marquage — fiche de démo complète (« Exemple casquette »).
    printable: true,
    markingPositions: [
      {
        name: 'Devant',
        maxWidthMm: 90,
        maxHeightMm: 50,
        techniques: [
          { technique: 'embroidery', maxColors: 8, defaultSetupCharge: 35 },
          { technique: 'transfer', maxColors: 6, defaultSetupCharge: 25 },
        ],
      },
      {
        name: 'Côté gauche',
        maxWidthMm: 50,
        maxHeightMm: 40,
        techniques: [{ technique: 'embroidery', maxColors: 6, defaultSetupCharge: 30 }],
      },
      {
        name: 'Arrière (bande de serrage)',
        maxWidthMm: 60,
        maxHeightMm: 20,
        techniques: [{ technique: 'woven-badge', defaultSetupCharge: 20 }],
      },
    ],
    markingPriceTiers: [
      { technique: 'embroidery', minQuantity: 50, unitPrice: 1.2 },
      { technique: 'embroidery', minQuantity: 250, unitPrice: 0.85 },
      { technique: 'embroidery', minQuantity: 500, unitPrice: 0.65 },
      { technique: 'transfer', minQuantity: 50, unitPrice: 0.9 },
      { technique: 'transfer', minQuantity: 250, unitPrice: 0.6 },
    ],
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
    const eco = await app.container.make(ProductEcoService)
    const suppliers = await Supplier.query().select('id', 'slug')
    const categories = await Category.query().select('id', 'slug')
    const attributes = await Attribute.query().select('id', 'slug')
    const values = await AttributeValue.query().select('id', 'slug', 'attributeId')
    const certifications = await Certification.query().select('id', 'slug', 'isEco')
    const markingTechniques = await MarkingTechnique.query().select('id', 'slug')

    const supplierBySlug = new Map(suppliers.map((s) => [s.slug, s.id]))
    const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]))
    const attributeBySlug = new Map(attributes.map((a) => [a.slug, a.id]))
    const certificationBySlug = new Map(certifications.map((c) => [c.slug, c]))
    const markingTechniqueBySlug = new Map(markingTechniques.map((t) => [t.slug, t.id]))

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
          // Conformité (écart 4) : saisies ; `isEco` dérivé plus bas.
          recycledContentPercent: seed.recycledContentPercent ?? null,
          cautionComment: seed.cautionComment ?? null,
          // Marquage structuré (écart 2) : produit personnalisable ?
          printable: seed.printable ?? false,
        }
      )

      for (const locale of Object.keys(seed.translations) as SeedLocale[]) {
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

      // Labels de conformité au niveau produit (écart 4).
      const seededCertifications = (seed.certifications ?? [])
        .map((slug) => certificationBySlug.get(slug))
        .filter((certification): certification is Certification => certification !== undefined)
      await product.related('certifications').sync(seededCertifications.map((c) => c.id))

      // Dérive « Éco-responsable » (écart 4) comme le ferait le pipeline : part
      // de recyclé, matières portées, labels éco. Jamais saisi.
      product.isEco = eco.deriveIsEco({
        recycledContentPercent: product.recycledContentPercent,
        // Seule la valeur de l'attribut `material` compte (pas couleur/nuance…).
        materialSlugs: seed.facets[MATERIAL_ATTRIBUTE_SLUG]
          ? [seed.facets[MATERIAL_ATTRIBUTE_SLUG]]
          : [],
        hasEcoCertification: seededCertifications.some((c) => c.isEco),
      })
      await product.save()

      // Conditionnement / logistique (écart 3) : upsert 1:1 si renseigné.
      if (seed.packaging) {
        await ProductPackaging.updateOrCreate(
          { productId: product.id },
          {
            packageType: seed.packaging.packageType ?? null,
            unitGrossWeightG: seed.packaging.unitGrossWeightG ?? null,
            innerCartonQty: seed.packaging.innerCartonQty ?? null,
            outerCartonQty: seed.packaging.outerCartonQty ?? null,
            outerCartonLengthMm: seed.packaging.outerCartonLengthMm ?? null,
            outerCartonWidthMm: seed.packaging.outerCartonWidthMm ?? null,
            outerCartonHeightMm: seed.packaging.outerCartonHeightMm ?? null,
            outerCartonGrossWeightG: seed.packaging.outerCartonGrossWeightG ?? null,
            outerCartonVolumeM3:
              seed.packaging.outerCartonVolumeM3 !== undefined
                ? String(seed.packaging.outerCartonVolumeM3)
                : null,
          }
        )
      }

      // Marquage structuré (écart 2) : remplacement d'ensemble (comme le service).
      // Supprime positions (techniques en cascade) + grille de prix, puis recrée.
      if (seed.markingPositions !== undefined || seed.markingPriceTiers !== undefined) {
        await ProductMarkingPosition.query().where('productId', product.id).delete()
        await ProductMarkingPriceTier.query().where('productId', product.id).delete()
      }
      for (const [index, pos] of (seed.markingPositions ?? []).entries()) {
        const position = await ProductMarkingPosition.create({
          productId: product.id,
          name: pos.name,
          maxWidthMm: pos.maxWidthMm ?? null,
          maxHeightMm: pos.maxHeightMm ?? null,
          templateDocumentId: null,
          position: index,
        })
        for (const technique of pos.techniques) {
          const techniqueId = markingTechniqueBySlug.get(technique.technique)
          if (techniqueId === undefined) continue
          await ProductMarkingPositionTechnique.create({
            markingPositionId: position.id,
            markingTechniqueId: techniqueId,
            maxColors: technique.maxColors ?? null,
            defaultSetupCharge:
              technique.defaultSetupCharge !== undefined
                ? String(technique.defaultSetupCharge)
                : null,
          })
        }
      }
      await this.seedPriceTiers(product.id, seed.priceTiers)

      for (const tier of seed.markingPriceTiers ?? []) {
        const techniqueId = markingTechniqueBySlug.get(tier.technique)
        if (techniqueId === undefined) continue
        await ProductMarkingPriceTier.create({
          productId: product.id,
          markingTechniqueId: techniqueId,
          minQuantity: tier.minQuantity,
          unitPrice: String(tier.unitPrice),
          currency: 'EUR',
        })
      }
    }
  }

  /**
   * Grille de prix du produit : remplacement d'ensemble des paliers produit
   * (`variantId` null), donc idempotent. Sans grille, rien n'est touché : le
   * produit reste volontairement « sans prix » dans le panier de devis.
   * (Étape d'orchestration à effets du seeder, d'où la méthode privée.)
   */
  private async seedPriceTiers(productId: number, tiers: ProductSeed['priceTiers']) {
    if (tiers === undefined) return
    await ProductPriceTier.query().where('productId', productId).whereNull('variantId').delete()
    await ProductPriceTier.createMany(
      tiers.map((tier) => ({
        productId,
        variantId: null,
        minQuantity: tier.minQuantity,
        unitPrice: String(tier.unitPrice),
        currency: 'EUR',
      }))
    )
  }
}
