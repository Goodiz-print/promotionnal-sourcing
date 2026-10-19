import type User from '#models/user'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class UserTransformer extends BaseTransformer<User> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'fullName',
        'email',
        'createdAt',
        'updatedAt',
        'initials',
      ]),
      // Pilote l'entrée « Administration » du menu (jamais une autorisation :
      // le serveur re-vérifie via le middleware `platformAdmin`).
      isPlatformAdmin: this.resource.isPlatformAdmin,
    }
  }
}
