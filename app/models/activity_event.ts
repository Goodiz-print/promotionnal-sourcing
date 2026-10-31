import { ActivityEventSchema } from '#database/schema'
import type { ActivityEventTargetType, ActivityEventType } from '#shared/types/activity_event'

/**
 * Une consultation ou une étape du funnel acheteur (#172). En ajout seul :
 * aucune colonne `updated_at`.
 */
export default class ActivityEvent extends ActivityEventSchema {
  static table = 'activity_events'

  declare type: ActivityEventType
  declare targetType: ActivityEventTargetType
}
