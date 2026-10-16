import type { ApplicationService } from '@adonisjs/core/types'
import StorageDriver from '#services/storage/storage_driver'
import CellarStorageDriver from '#services/storage/cellar_storage_driver'

/**
 * Lie l'abstraction `StorageDriver` à l'implémentation Cellar. Singleton : le
 * client S3 n'est créé qu'une fois. Les consommateurs injectent
 * `StorageDriver` (jamais `new CellarStorageDriver()`).
 */
export default class StorageProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(StorageDriver, (resolver) => {
      return resolver.make(CellarStorageDriver)
    })
  }
}
