import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { SupplierContactSchema } from '#database/schema'
import Organization from '#models/organization'
import User from '#models/user'

/**
 * Contact de l'équipe commerciale d'un fournisseur (#241). Montré aux agences
 * connectées, uniquement si le fournisseur est abonné, et filtré selon le pays
 * de l'agence : la règle vit dans `SupplierContactService.visibleFor`.
 */
export default class SupplierContact extends SupplierContactSchema {
  static table = 'supplier_contacts'

  declare languages: string[]
  /** Pays couverts (ISO alpha-2, majuscules). Liste vide : tous les pays. */
  declare countries: string[]

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  /** Membre du compte fournisseur, quand le commercial se connecte aussi. */
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
