/**
 * Documents joints par un fournisseur (#60). Le type est une chaîne validée ici
 * (pas d'enum SQL) : ajouter une nature de document = une entrée ici.
 */
export const ORGANIZATION_DOCUMENT_KINDS = ['catalogue', 'certificate', 'other'] as const

export type OrganizationDocumentKind = (typeof ORGANIZATION_DOCUMENT_KINDS)[number]

/** Taille maximale d'un PDF accepté, avant compression. */
export const DOCUMENT_MAX_SIZE = '20mb' as const

/** Type MIME servi pour tous les documents stockés. */
export const DOCUMENT_MIME_TYPE = 'application/pdf' as const
