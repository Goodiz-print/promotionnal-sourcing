/**
 * Documents joints par un fournisseur (#60). Le type est une chaîne validée ici
 * (pas d'enum SQL) : ajouter une nature de document = une entrée ici.
 */
export const ORGANIZATION_DOCUMENT_KINDS = ['catalogue', 'certificate', 'other'] as const

export type OrganizationDocumentKind = (typeof ORGANIZATION_DOCUMENT_KINDS)[number]

/**
 * Nature d'une fiche PDF rattachée à un produit (écart 4). Enum SQL sur
 * `product_documents.type` (défaut `spec_sheet`). `marking_template` est réservé
 * au futur gabarit de marquage (écart 2). Son libellé est rendu côté UI via
 * `t('documents.types.<type>')`, pas stocké en base.
 */
export const PRODUCT_DOCUMENT_TYPES = [
  'spec_sheet',
  'safety',
  'certificate',
  'marking_template',
  'other',
] as const

export type ProductDocumentType = (typeof PRODUCT_DOCUMENT_TYPES)[number]

export const DEFAULT_PRODUCT_DOCUMENT_TYPE: ProductDocumentType = 'spec_sheet'

/** Taille maximale d'un PDF accepté, avant compression. */
export const DOCUMENT_MAX_SIZE = '20mb' as const

/** Type MIME servi pour tous les documents stockés. */
export const DOCUMENT_MIME_TYPE = 'application/pdf' as const

/**
 * Document PDF exposé au frontend (`url` : lien public Cellar). Déclaré en `type`
 * — contrainte props Inertia `Record<string, JSONDataTypes>`.
 */
export type DocumentType = {
  id: number
  originalName: string
  sizeBytes: number
  url: string
}

/** Document du profil fournisseur : un `DocumentType` classé par nature. */
export type OrganizationDocumentType = DocumentType & {
  kind: OrganizationDocumentKind
}

/** Fiche PDF d'un produit : un `DocumentType` typé par sa nature (écart 4). */
export type ProductDocumentFile = DocumentType & {
  type: ProductDocumentType
}
