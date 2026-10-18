import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { OrganizationDocumentSchema } from '#database/schema'
import Organization from '#models/organization'
import StorageObject from '#models/storage_object'
import type { OrganizationDocumentKind } from '#shared/types/document'

/**
 * Document PDF joint au profil d'une organisation fournisseur.
 */
export default class OrganizationDocument extends OrganizationDocumentSchema {
  static table = 'organization_documents'

  declare kind: OrganizationDocumentKind

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => StorageObject, { foreignKey: 'storageObjectId' })
  declare storageObject: BelongsTo<typeof StorageObject>
}
