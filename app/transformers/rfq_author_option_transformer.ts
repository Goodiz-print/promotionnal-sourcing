import { BaseTransformer } from '@adonisjs/core/transformers'
import type User from '#models/user'
import type { RfqAuthorOptionType } from '#shared/types/rfq'

/**
 * Auteur proposé par le filtre de « Mes demandes » (#228) : son nom, ou son
 * adresse s'il n'en a pas renseigné. Rien d'autre du compte n'est exposé.
 */
export default class RfqAuthorOptionTransformer extends BaseTransformer<User> {
  toObject(): RfqAuthorOptionType {
    return {
      id: this.resource.id,
      name: this.resource.fullName ?? this.resource.email,
    }
  }
}
