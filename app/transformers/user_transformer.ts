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
      // Pilotent l'entrée « Administration » du menu et les onglets du back-office
      // (jamais une autorisation : le serveur re-vérifie chaque route).
      isPlatformAdmin: this.resource.isPlatformAdmin,
      platformRole: this.resource.platformRole,
    }
  }
}
