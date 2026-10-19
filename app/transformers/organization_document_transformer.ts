import type OrganizationDocument from '#models/organization_document'
import type StorageObject from '#models/storage_object'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type { OrganizationDocumentType } from '#shared/types/document'

/**
 * Requiert `storageObject` préchargé. `urlFor` vient de `DocumentService.urlFor`
 * (le transformer n'a pas accès au conteneur).
 */
export default class OrganizationDocumentTransformer extends BaseTransformer<OrganizationDocument> {
  constructor(
    resource: OrganizationDocument,
    protected urlFor: (object: StorageObject) => string
  ) {
    super(resource)
  }

  toObject(): OrganizationDocumentType {
    return {
      id: this.resource.id,
      kind: this.resource.kind,
      originalName: this.resource.originalName,
      sizeBytes: this.resource.sizeBytes,
      url: this.urlFor(this.resource.storageObject),
    }
  }
}
