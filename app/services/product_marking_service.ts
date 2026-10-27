import { inject } from '@adonisjs/core'
import MarkingTechnique from '#models/marking_technique'
import ProductDocument from '#models/product_document'
import ProductMarkingPosition from '#models/product_marking_position'
import ProductMarkingPositionTechnique from '#models/product_marking_position_technique'
import ProductMarkingPriceTier from '#models/product_marking_price_tier'
import { invalidMarkingInput } from '#exceptions/catalogue_errors'
import type Product from '#models/product'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type {
  ProductMarkingPositionInput,
  ProductMarkingPriceTierInput,
} from '#shared/types/marking'

/**
 * Marquage structuré d'un produit (écart 2) : positions, techniques possibles par
 * position, et grille de prix de marquage. Appelé par `SupplierProductService`
 * **dans la transaction du produit** : toute incohérence (technique inconnue,
 * technique dupliquée, gabarit étranger…) lève une erreur de validation qui
 * annule l'ensemble.
 *
 * Sémantique « remplace l'ensemble » (comme variantes / paliers) : `undefined` =
 * inchangé ; un tableau (même vide) devient l'état cible, réécrit en entier.
 */
@inject()
export default class ProductMarkingService {
  async sync(
    trx: TransactionClientContract,
    product: Product,
    positions: ProductMarkingPositionInput[] | undefined,
    priceTiers: ProductMarkingPriceTierInput[] | undefined
  ): Promise<void> {
    if (positions === undefined && priceTiers === undefined) return

    // Techniques référencées par les positions **et** la grille, résolues en une
    // seule requête d'existence partagée par les deux synchronisations.
    const referenced = new Set<number>()
    for (const position of positions ?? [])
      for (const technique of position.techniques ?? [])
        referenced.add(technique.markingTechniqueId)
    for (const tier of priceTiers ?? []) referenced.add(tier.markingTechniqueId)
    const knownTechniques = await this.knownTechniqueIds(trx, [...referenced])

    if (positions !== undefined) await this.syncPositions(trx, product, positions, knownTechniques)
    if (priceTiers !== undefined)
      await this.syncPriceTiers(trx, product, priceTiers, knownTechniques)
  }

  /**
   * Positions réécrites à chaque synchronisation (leurs techniques partent en
   * cascade). Chaque position reçoit son `position` = ordre dans le tableau. Le
   * gabarit, s'il est fourni, doit être un document **du produit** de type
   * `marking_template` ; une technique doit exister et n'apparaître qu'une fois
   * par position.
   */
  private async syncPositions(
    trx: TransactionClientContract,
    product: Product,
    inputs: ProductMarkingPositionInput[],
    knownTechniques: Set<number>
  ): Promise<void> {
    // Gabarits valides : documents du produit de type `marking_template`.
    const validTemplates = await this.validTemplateIds(trx, product, inputs)

    // Remplacement d'ensemble : supprime tout, puis recrée (techniques en cascade).
    await ProductMarkingPosition.query({ client: trx }).where('productId', product.id).delete()

    for (const [index, input] of inputs.entries()) {
      if (input.templateDocumentId && !validTemplates.has(input.templateDocumentId)) {
        throw invalidMarkingInput(
          `markingPositions.${index}.templateDocumentId`,
          'Template must be a product document of type marking_template',
          'exists'
        )
      }

      const position = await ProductMarkingPosition.create(
        {
          productId: product.id,
          name: input.name,
          maxWidthMm: input.maxWidthMm ?? null,
          maxHeightMm: input.maxHeightMm ?? null,
          templateDocumentId: input.templateDocumentId ?? null,
          position: index,
        },
        { client: trx }
      )

      const seen = new Set<number>()
      const rows = (input.techniques ?? []).map((technique, techniqueIndex) => {
        const field = `markingPositions.${index}.techniques.${techniqueIndex}.markingTechniqueId`
        if (!knownTechniques.has(technique.markingTechniqueId)) {
          throw invalidMarkingInput(field, 'Unknown marking technique', 'exists')
        }
        if (seen.has(technique.markingTechniqueId)) {
          throw invalidMarkingInput(field, 'Duplicate technique on position', 'unique')
        }
        seen.add(technique.markingTechniqueId)
        return {
          markingPositionId: position.id,
          markingTechniqueId: technique.markingTechniqueId,
          maxColors: technique.maxColors ?? null,
          defaultSetupCharge:
            typeof technique.defaultSetupCharge === 'number'
              ? String(technique.defaultSetupCharge)
              : null,
        }
      })
      if (rows.length > 0) {
        await ProductMarkingPositionTechnique.createMany(rows, { client: trx })
      }
    }
  }

  /**
   * Grille de prix de marquage : réécrite à chaque synchronisation. Technique
   * existante, unicité (technique, quantité), devise reprise du produit.
   */
  private async syncPriceTiers(
    trx: TransactionClientContract,
    product: Product,
    inputs: ProductMarkingPriceTierInput[],
    knownTechniques: Set<number>
  ): Promise<void> {
    const seen = new Set<string>()
    const rows = inputs.map((input, index) => {
      if (!knownTechniques.has(input.markingTechniqueId)) {
        throw invalidMarkingInput(
          `markingPriceTiers.${index}.markingTechniqueId`,
          'Unknown marking technique',
          'exists'
        )
      }
      const key = `${input.markingTechniqueId}:${input.minQuantity}`
      if (seen.has(key)) {
        throw invalidMarkingInput(
          `markingPriceTiers.${index}.minQuantity`,
          'Duplicate marking tier',
          'unique'
        )
      }
      seen.add(key)

      return {
        productId: product.id,
        markingTechniqueId: input.markingTechniqueId,
        minQuantity: input.minQuantity,
        unitPrice: String(input.unitPrice),
        currency: product.currency ?? 'EUR',
      }
    })

    await ProductMarkingPriceTier.query({ client: trx }).where('productId', product.id).delete()
    if (rows.length > 0) await ProductMarkingPriceTier.createMany(rows, { client: trx })
  }

  /**
   * Identifiants de techniques **existants** parmi ceux fournis (garde contre un
   * id inconnu ou forgé, comme `syncFacets` pour les facettes).
   */
  private async knownTechniqueIds(
    trx: TransactionClientContract,
    ids: number[]
  ): Promise<Set<number>> {
    const unique = [...new Set(ids)]
    if (unique.length === 0) return new Set<number>()
    const rows = await MarkingTechnique.query({ client: trx }).whereIn('id', unique).select('id')
    return new Set(rows.map((row) => row.id))
  }

  /**
   * Gabarits (documents) utilisables par les positions : les documents **du
   * produit** de type `marking_template` parmi les `templateDocumentId` fournis.
   */
  private async validTemplateIds(
    trx: TransactionClientContract,
    product: Product,
    inputs: ProductMarkingPositionInput[]
  ): Promise<Set<number>> {
    const wanted = new Set<number>()
    for (const input of inputs) if (input.templateDocumentId) wanted.add(input.templateDocumentId)
    if (wanted.size === 0) return new Set<number>()

    const documents = await ProductDocument.query({ client: trx })
      .where('productId', product.id)
      .where('type', 'marking_template')
      .whereIn('id', [...wanted])
      .select('id')
    return new Set(documents.map((document) => document.id))
  }
}
