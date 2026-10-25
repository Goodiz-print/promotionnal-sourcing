import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { BillingProfileSchema } from '#database/schema'
import Organization from '#models/organization'

/**
 * Facturation d'une organisation. Le moyen de paiement reste chez Stripe.
 */
export default class BillingProfile extends BillingProfileSchema {
  static table = 'billing_profiles'

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>
}
