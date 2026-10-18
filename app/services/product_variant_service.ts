import { inject } from '@adonisjs/core'
import AttributeValue from '#models/attribute_value'
import ProductImage from '#models/product_image'
import ProductPriceTier from '#models/product_price_tier'
import ProductVariant from '#models/product_variant'
import ProductVariantAttribute from '#models/product_variant_attribute'
import { invalidVariantInput } from '#exceptions/catalogue_errors'
import type Product from '#models/product'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ProductPriceTierInput, ProductVariantInput } from '#shared/types/product'

/**
 * Variantes et paliers de prix d'un produit. Appelé par `SupplierProductService`
 * **dans la transaction du produit** : toute incohérence (SKU en double, palier
 * dupliqué…) lève une erreur de validation qui annule l'ensemble.
 *
 * Sémantique « remplace l'ensemble » : `undefined` = inchangé ; un tableau (même
 * vide) devient l'état cible. Les variantes sont rapprochées par SKU, les
 * paliers sont réécrits.
 */
@inject()
export default class ProductVariantService {
  /**
   * Applique variantes puis paliers, puis recalcule la fourchette de prix
   * dénormalisée du produit (`price_min`/`price_max`).
   */
  async sync(
    trx: TransactionClientContract,
    product: Product,
    variants: ProductVariantInput[] | undefined,
    priceTiers: ProductPriceTierInput[] | undefined
  ): Promise<void> {
    if (variants !== undefined) await this.syncVariants(trx, product, variants)
    if (priceTiers !== undefined) await this.syncPriceTiers(trx, product, priceTiers)
    if (variants !== undefined || priceTiers !== undefined) {
      await this.refreshPriceRange(trx, product)
    }
  }

  /**
   * Variantes par SKU : mise à jour des existantes, création des nouvelles,
   * suppression des absentes (leurs paliers partent en cascade).
   */
  private async syncVariants(
    trx: TransactionClientContract,
    product: Product,
    inputs: ProductVariantInput[]
  ): Promise<void> {
    const seen = new Set<string>()
    inputs.forEach((input, index) => {
      if (seen.has(input.sku)) {
        throw invalidVariantInput(`variants.${index}.sku`, 'Duplicate SKU', 'unique')
      }
      seen.add(input.sku)
    })

    await this.assertImagesBelong(trx, product, inputs)

    const existing = await ProductVariant.query({ client: trx }).where('productId', product.id)
    const bySku = new Map(existing.map((variant) => [variant.sku, variant]))

    const kept = new Set<number>()
    for (const [index, input] of inputs.entries()) {
      let variant = bySku.get(input.sku)
      if (variant) {
        variant.useTransaction(trx)
        variant.merge({
          isActive: input.isActive ?? variant.isActive,
          imageId: input.imageId === undefined ? variant.imageId : input.imageId,
        })
        await variant.save()
      } else {
        variant = await ProductVariant.create(
          {
            productId: product.id,
            sku: input.sku,
            isActive: input.isActive ?? true,
            imageId: input.imageId ?? null,
          },
          { client: trx }
        )
      }
      kept.add(variant.id)
      if (input.attributeValueIds !== undefined) {
        await this.syncAttributes(trx, variant, index, input.attributeValueIds)
      }
    }

    const removed = existing.filter((variant) => !kept.has(variant.id)).map((v) => v.id)
    if (removed.length > 0) {
      await ProductVariant.query({ client: trx }).whereIn('id', removed).delete()
    }
  }

  /**
   * Valeurs d'attribut de la variante (couleur = rouge) : une seule valeur par
   * attribut, toutes existantes.
   */
  private async syncAttributes(
    trx: TransactionClientContract,
    variant: ProductVariant,
    index: number,
    valueIds: number[]
  ): Promise<void> {
    const uniqueIds = [...new Set(valueIds)]
    const values =
      uniqueIds.length > 0
        ? await AttributeValue.query({ client: trx })
            .whereIn('id', uniqueIds)
            .select('id', 'attributeId')
        : []
    const field = `variants.${index}.attributeValueIds`
    if (values.length !== uniqueIds.length) {
      throw invalidVariantInput(field, 'Unknown attribute value', 'exists')
    }
    if (new Set(values.map((value) => value.attributeId)).size !== values.length) {
      throw invalidVariantInput(field, 'One value per attribute', 'unique')
    }

    await ProductVariantAttribute.query({ client: trx }).where('variantId', variant.id).delete()
    await ProductVariantAttribute.createMany(
      values.map((value) => ({
        variantId: variant.id,
        attributeId: value.attributeId,
        attributeValueId: value.id,
      })),
      { client: trx }
    )
  }

  /**
   * Les images référencées doivent appartenir à la galerie du produit.
   */
  private async assertImagesBelong(
    trx: TransactionClientContract,
    product: Product,
    inputs: ProductVariantInput[]
  ): Promise<void> {
    const wanted = new Set<number>()
    for (const input of inputs) if (input.imageId) wanted.add(input.imageId)
    if (wanted.size === 0) return

    const owned = await ProductImage.query({ client: trx })
      .where('productId', product.id)
      .whereIn('id', [...wanted])
      .select('id')
    if (owned.length === wanted.size) return

    const index = inputs.findIndex(
      (input) => input.imageId && !owned.some((image) => image.id === input.imageId)
    )
    throw invalidVariantInput(`variants.${index}.imageId`, 'Unknown product image', 'exists')
  }

  /**
   * Paliers : réécrits à chaque synchronisation. `variantSku` est résolu sur les
   * variantes **après** leur synchronisation ; unicité (variante, quantité).
   */
  private async syncPriceTiers(
    trx: TransactionClientContract,
    product: Product,
    inputs: ProductPriceTierInput[]
  ): Promise<void> {
    const variants = await ProductVariant.query({ client: trx }).where('productId', product.id)
    const idBySku = new Map(variants.map((variant) => [variant.sku, variant.id]))

    const seen = new Set<string>()
    const rows = inputs.map((input, index) => {
      let variantId: number | null = null
      if (input.variantSku) {
        const id = idBySku.get(input.variantSku)
        if (id === undefined) {
          throw invalidVariantInput(`priceTiers.${index}.variantSku`, 'Unknown SKU', 'exists')
        }
        variantId = id
      }
      const key = `${variantId ?? 'product'}:${input.minQuantity}`
      if (seen.has(key)) {
        throw invalidVariantInput(`priceTiers.${index}.minQuantity`, 'Duplicate tier', 'unique')
      }
      seen.add(key)

      return {
        productId: product.id,
        variantId,
        minQuantity: input.minQuantity,
        unitPrice: String(input.unitPrice),
        currency: product.currency,
      }
    })

    await ProductPriceTier.query({ client: trx }).where('productId', product.id).delete()
    if (rows.length > 0) await ProductPriceTier.createMany(rows, { client: trx })
  }

  /**
   * Recalcule `products.price_min`/`price_max` (dénormalisés pour le tri et les
   * cartes) depuis les paliers. Sans palier, la saisie manuelle est conservée.
   */
  private async refreshPriceRange(trx: TransactionClientContract, product: Product): Promise<void> {
    const range = await ProductPriceTier.query({ client: trx })
      .where('productId', product.id)
      .min('unit_price as min')
      .max('unit_price as max')
      .first()
    const min = range?.$extras.min as string | null | undefined
    const max = range?.$extras.max as string | null | undefined
    if (min === null || min === undefined || max === null || max === undefined) return

    product.useTransaction(trx)
    await product.merge({ priceMin: min, priceMax: max }).save()
  }
}
