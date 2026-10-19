import factory from '@adonisjs/lucid/factories'
import OrganizationDocument from '#models/organization_document'

/**
 * Document d'organisation sans fichier réel (métadonnées seules). `organizationId`
 * est à fournir par l'appelant ; `storageObjectId` peut l'être pour un test réel.
 */
export const OrganizationDocumentFactory = factory
  .define(OrganizationDocument, ({ faker }) => ({
    kind: 'catalogue' as const,
    originalName: `${faker.system.commonFileName('pdf')}`,
    sizeBytes: faker.number.int({ min: 1000, max: 500000 }),
    storageObjectId: null,
  }))
  .build()
