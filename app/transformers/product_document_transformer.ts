import type ProductDocument from '#models/product_document'
import type StorageObject from '#models/storage_object'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type { ProductDocumentFile } from '#shared/types/document'

/**
 * Fiche technique d'un produit. Requiert `storageObject` préchargé ; `urlFor`
 * vient de `DocumentService.urlFor`.
 */
export default class ProductDocumentTransformer extends BaseTransformer<ProductDocument> {
  constructor(
    resource: ProductDocument,
    protected urlFor: (object: StorageObject) => string
  ) {
    super(resource)
  }

  toObject(): ProductDocumentFile {
    return {
      id: this.resource.id,
      originalName: this.resource.originalName,
      sizeBytes: this.resource.sizeBytes,
      url: this.urlFor(this.resource.storageObject),
      // Nature du document (écart 4).
      type: this.resource.type,
    }
  }
}
