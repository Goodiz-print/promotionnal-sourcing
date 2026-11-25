import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { OrganizationSubscriptionSchema } from '#database/schema'
import Organization from '#models/organization'
import User from '#models/user'
import type { PaidSubscriptionPlan, SubscriptionStatus } from '#shared/types/subscription'

/**
 * Période d'abonnement d'une organisation (cf. `docs/abonnements.md`). Les
 * lignes terminées restent en base : elles forment l'historique.
 */
export default class OrganizationSubscription extends OrganizationSubscriptionSchema {
  static table = 'organization_subscriptions'

  declare plan: PaidSubscriptionPlan
  declare status: SubscriptionStatus

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  /** Admin qui a saisi un abonnement manuel (`null` pour un abonnement en ligne). */
  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdBy: BelongsTo<typeof User>
}
