import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import StorageObject from '#models/storage_object'

/**
 * Objet de stockage `ready` par défaut. Le checksum est aléatoire (64 hex) et
 * la clé en dérive, comme en production.
 */
export const StorageObjectFactory = factory
  .define(StorageObject, ({ faker }) => {
    const checksum = faker.string.hexadecimal({ length: 64, prefix: '', casing: 'lower' })
    return {
      key: `promotionnal-sourcing/test/${checksum}.jpg`,
      checksum,
      mimeType: 'image/jpeg',
      size: faker.number.int({ min: 1_000, max: 500_000 }),
      status: 'ready' as const,
    }
  })
  .state('pendingUpload', (object) => {
    object.status = 'pending_upload'
  })
  .state('pendingDelete', (object) => {
    object.status = 'pending_delete'
  })
  .state('stale', (object) => {
    // Plus vieux que le seuil de reprise (24 h).
    object.createdAt = DateTime.now().minus({ hours: 25 })
  })
  .build()
