import vine from '@vinejs/vine'
import { CONTENT_LOCALES } from '#shared/types/i18n'
import { PRODUCT_LIFECYCLE_STATUSES } from '#shared/types/product'

/** Listes par locale (écart 5) : mots-clés et arguments marketing. */
const localizedList = () =>
  vine.array(vine.string().trim().minLength(1).maxLength(120)).maxLength(30).optional().nullable()

/**
 * Contenu localisé d'un produit (fabrique : un nœud VineJS neuf par appel).
 */
const localizedContent = () =>
  vine.object({
    name: vine.string().minLength(2).maxLength(255).trim(),
    description: vine.string().maxLength(5000).trim().optional().nullable(),
    keywords: localizedList(),
    marketingPoints: localizedList(),
  })

/**
 * Contenu localisé en mise à jour : tout est optionnel (on peut corriger la
 * seule description d'une langue).
 */
const partialLocalizedContent = () =>
  vine.object({
    name: vine.string().minLength(2).maxLength(255).trim().optional(),
    description: vine.string().maxLength(5000).trim().optional().nullable(),
    keywords: localizedList(),
    marketingPoints: localizedList(),
  })

const sourceLocale = () => vine.enum(CONTENT_LOCALES)

/**
 * Variante : SKU unique par produit (contrôlé par le service), valeurs
 * d'attribut (couleur = rouge…) et image **déjà en galerie** (édition).
 */
const variantInput = () =>
  vine.object({
    sku: vine.string().minLength(1).maxLength(100).trim(),
    isActive: vine.boolean().optional(),
    imageId: vine.number().positive().optional().nullable(),
    // EAN/GTIN (8 à 14 chiffres) par variante (écart 5).
    gtin: vine
      .string()
      .trim()
      .regex(/^\d{8,14}$/)
      .optional()
      .nullable(),
    attributeValueIds: vine.array(vine.number().positive()).optional(),
  })

/**
 * Palier de prix dégressif : `variantSku` absent = palier du produit.
 */
const priceTierInput = () =>
  vine.object({
    variantSku: vine.string().maxLength(100).trim().optional().nullable(),
    minQuantity: vine.number().withoutDecimals().positive(),
    unitPrice: vine.number().positive(),
  })

/**
 * Entier logistique borné (poids / quantité / dimension), optionnel. `min(1)`
 * (pas seulement « positif ») aligne la borne basse sur le formulaire ; `max`
 * garde la valeur dans un `integer` PostgreSQL — sans quoi une saisie énorme
 * lèverait un `out of range` (500) qui perdrait toute la sauvegarde produit.
 */
const boundedInt = (max: number) =>
  vine.number().withoutDecimals().min(1).max(max).optional().nullable()

/**
 * Conditionnement / logistique (écart 3) : tous les champs optionnels. Poids,
 * quantités et dimensions = entiers positifs **bornés** ; volume = décimal
 * positif borné (dans `numeric(12,4)`, min = pas de la colonne pour éviter un
 * arrondi silencieux à `0`). Un champ **absent de l'objet** `packaging` fourni
 * est remis à `null` (remplacement complet du bloc, pas un merge partiel) ; voir
 * `SupplierProductService.syncPackaging`.
 */
const packagingInput = () =>
  vine.object({
    packageType: vine.string().trim().maxLength(120).optional().nullable(),
    // Poids en grammes : jusqu'à 100 t.
    unitGrossWeightG: boundedInt(100_000_000),
    innerCartonQty: boundedInt(1_000_000),
    outerCartonQty: boundedInt(1_000_000),
    // Dimensions en mm : jusqu'à 100 m.
    outerCartonLengthMm: boundedInt(100_000),
    outerCartonWidthMm: boundedInt(100_000),
    outerCartonHeightMm: boundedInt(100_000),
    outerCartonGrossWeightG: boundedInt(100_000_000),
    // Volume m³ dans `numeric(12,4)` (≤ 99 999 999,9999) ; pas = 0,0001.
    outerCartonVolumeM3: vine.number().min(0.0001).max(100_000).optional().nullable(),
  })

/**
 * Technique possible sur une position de marquage (écart 2). `markingTechniqueId`
 * doit référencer une technique existante (contrôlé par le service). `maxColors`
 * borné (une impression dépasse rarement 16 couleurs) ; `defaultSetupCharge` est
 * un décimal positif borné (dans `numeric(12,4)`, pas = 0,0001).
 */
const markingPositionTechniqueInput = () =>
  vine.object({
    markingTechniqueId: vine.number().withoutDecimals().positive(),
    maxColors: vine.number().withoutDecimals().min(1).max(32).optional().nullable(),
    defaultSetupCharge: vine.number().min(0).max(1_000_000).optional().nullable(),
  })

/**
 * Position de marquage saisie (écart 2) : nom requis, dimensions max entières
 * positives optionnelles, gabarit (`templateDocumentId`, contrôlé par le service
 * = document du produit de type `marking_template`) et techniques possibles.
 * L'ordre du tableau donne la `position`.
 */
const markingPositionInput = () =>
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    // Dimensions en mm : jusqu'à 100 m (comme les dimensions logistiques).
    maxWidthMm: boundedInt(100_000),
    maxHeightMm: boundedInt(100_000),
    templateDocumentId: vine.number().withoutDecimals().positive().optional().nullable(),
    techniques: vine.array(markingPositionTechniqueInput()).maxLength(32).optional(),
  })

/**
 * Palier de la grille de prix de marquage (écart 2) : quantité mini > 0, prix
 * unitaire >= 0, technique référencée (contrôlée par le service). La devise est
 * reprise du produit.
 */
const markingPriceTierInput = () =>
  vine.object({
    markingTechniqueId: vine.number().withoutDecimals().positive(),
    minQuantity: vine.number().withoutDecimals().positive(),
    unitPrice: vine.number().min(0),
  })

/**
 * Champs communs (colonnes neutres, facettes, galerie).
 */
const commonFields = () => ({
  priceMin: vine.number().positive().optional().nullable(),
  priceMax: vine.number().positive().optional().nullable(),
  currency: vine.string().maxLength(3).optional(),
  minQuantity: vine.number().positive().optional().nullable(),
  originCountry: vine.string().maxLength(2).optional().nullable(),
  madeInEurope: vine.boolean().optional(),
  isActive: vine.boolean().optional(),
  // Identité / classification (écart 5). `origin_zone` n'est PAS saisissable :
  // c'est une colonne dérivée (`ProductOriginService`).
  brand: vine.string().trim().maxLength(255).optional().nullable(),
  hsCode: vine
    .string()
    .trim()
    .regex(/^\d{6,10}$/)
    .optional()
    .nullable(),
  isConfigurable: vine.boolean().optional(),
  lifecycleStatus: vine.enum(PRODUCT_LIFECYCLE_STATUSES).optional(),
  releasedAt: vine
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  supplierCategoryRaw: vine.string().trim().maxLength(255).optional().nullable(),
  // Commercial (écart 7).
  leadTimeDays: vine.number().withoutDecimals().min(0).max(3650).optional().nullable(),
  rushService: vine.boolean().optional(),
  rushLeadTimeDays: vine.number().withoutDecimals().min(0).max(3650).optional().nullable(),
  // Médias (écart 8).
  videoUrl: vine.string().trim().url().maxLength(2048).optional().nullable(),
  // Conformité (écart 4). `is_eco` n'est PAS saisissable : colonne dérivée
  // (`ProductEcoService`), calculée au save et à l'indexation.
  recycledContentPercent: vine.number().withoutDecimals().min(0).max(100).optional().nullable(),
  cautionComment: vine.string().trim().maxLength(2000).optional().nullable(),
  certificationIds: vine.array(vine.number().positive()).optional(),
  attributeValueIds: vine.array(vine.number().positive()).optional(),
  variants: vine.array(variantInput()).maxLength(100).optional(),
  priceTiers: vine.array(priceTierInput()).maxLength(50).optional(),
  // Conditionnement / logistique (écart 3). Absent = inchangé.
  packaging: packagingInput().optional(),
  // Marquage structuré (écart 2). `printable` = produit personnalisable ;
  // positions et grille de prix en remplacement d'ensemble (absent = inchangé).
  printable: vine.boolean().optional(),
  markingPositions: vine.array(markingPositionInput()).maxLength(20).optional(),
  markingPriceTiers: vine.array(markingPriceTierInput()).maxLength(100).optional(),
  images: vine
    .array(vine.file({ size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }))
    .maxLength(8)
    .optional(),
})

/**
 * Création d'un produit fournisseur. `sourceLocale` est obligatoire ; seule la
 * traduction de cette langue est requise (contrôlé par le service), les autres
 * langues sont optionnelles et générées automatiquement si absentes.
 */
export const createSupplierProductValidator = vine.create({
  categoryId: vine.number().positive(),
  sourceLocale: sourceLocale(),
  translations: vine.object({
    fr: localizedContent().optional(),
    en: localizedContent().optional(),
  }),
  ...commonFields(),
})

/**
 * Mise à jour partielle : rien n'est obligatoire. Un champ absent n'est pas
 * modifié ; une seule langue peut être corrigée sans renvoyer le produit.
 * `removedImageIds` n'existe qu'à l'édition.
 */
export const updateSupplierProductValidator = vine.create({
  categoryId: vine.number().positive().optional(),
  sourceLocale: sourceLocale().optional(),
  translations: vine
    .object({
      fr: partialLocalizedContent().optional(),
      en: partialLocalizedContent().optional(),
    })
    .optional(),
  ...commonFields(),
  removedImageIds: vine.array(vine.number().positive()).optional(),
})
