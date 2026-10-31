/**
 * Événements de consultation et de funnel acheteur (#172) : ce que les clients
 * regardent et font après une recherche.
 */
export const ACTIVITY_EVENT_TYPES = [
  'product_viewed',
  'supplier_viewed',
  'rfq_product_added',
  'rfq_sent',
] as const
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number]

export const ACTIVITY_EVENT_TARGET_TYPES = ['product', 'supplier', 'rfq'] as const
export type ActivityEventTargetType = (typeof ACTIVITY_EVENT_TARGET_TYPES)[number]

/** Une même vue répétée par un utilisateur connecté dans cette fenêtre n'est comptée qu'une fois. */
export const ACTIVITY_EVENT_DEDUP_MINUTES = 30

/** Ce que les écrans transmettent à `ActivityEventService.record`. */
export interface ActivityEventInput {
  type: ActivityEventType
  targetType: ActivityEventTargetType
  targetId: number
  userId: number | null
  organizationId: number | null
  /** Le visiteur a un rôle plateforme : consultation d'administration, non comptée. */
  isStaff: boolean
}

/** Payload du job d'écriture. */
export interface ActivityEventPayload extends Omit<ActivityEventInput, 'isStaff'> {
  occurredAt: string
}

/** Au-delà, le rattachement à l'utilisateur et à l'organisation est supprimé (RGPD). */
export const ACTIVITY_EVENT_PSEUDONYMIZE_AFTER_DAYS = 90

/** Au-delà, l'événement est supprimé (24 mois, comme le journal des recherches). */
export const ACTIVITY_EVENT_RETENTION_DAYS = 730

/** Lignes pseudonymisées / supprimées par une purge. */
export interface ActivityEventPurgeResult {
  pseudonymized: number
  deleted: number
}
