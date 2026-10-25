import vine from '@vinejs/vine'
import {
  DOCUMENT_MAX_SIZE,
  ORGANIZATION_DOCUMENT_KINDS,
  PRODUCT_DOCUMENT_TYPES,
} from '#shared/types/document'

/**
 * Téléversement d'un document d'organisation : nature et PDF (20 Mo maximum).
 * Le contenu est vérifié comme PDF par `DocumentService` (en-tête `%PDF-`).
 */
export const organizationDocumentValidator = vine.create({
  kind: vine.enum(ORGANIZATION_DOCUMENT_KINDS),
  file: vine.file({ size: DOCUMENT_MAX_SIZE, extnames: ['pdf'] }),
})

/**
 * Téléversement d'une fiche PDF produit (PDF, 20 Mo maximum). `type` est la
 * nature du document (écart 4), optionnelle : absente = fiche technique.
 */
export const productDocumentValidator = vine.create({
  type: vine.enum(PRODUCT_DOCUMENT_TYPES).optional(),
  file: vine.file({ size: DOCUMENT_MAX_SIZE, extnames: ['pdf'] }),
})
