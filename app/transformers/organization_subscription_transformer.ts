import { BaseTransformer } from '@adonisjs/core/transformers'
import type OrganizationSubscription from '#models/organization_subscription'
import type { CurrentSubscriptionType } from '#shared/types/subscription'

export default class OrganizationSubscriptionTransformer extends BaseTransformer<OrganizationSubscription> {
  toObject(): CurrentSubscriptionType {
    return {
      ...this.pick(this.resource, ['plan', 'status', 'origin', 'cancelAtPeriodEnd']),
      startsAt: this.resource.startsAt.toISO()!,
      endsAt: this.resource.endsAt?.toISO() ?? null,
    }
  }
}
