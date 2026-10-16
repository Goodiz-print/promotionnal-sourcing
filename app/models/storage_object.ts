import { StorageObjectSchema } from '#database/schema'
import type { StorageStatus } from '#shared/types/storage'

export default class StorageObject extends StorageObjectSchema {
  static table = 'storage_objects'

  declare status: StorageStatus
}
