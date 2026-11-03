/**
 * Actions tracées dans le journal d'audit du back-office. Chaque nouvelle
 * action d'écriture admin ajoute sa valeur ici (`<domaine>.<verbe>`).
 */
export const ADMIN_AUDIT_ACTIONS = [
  'platform_role.changed',
  'category.created',
  'category.updated',
  'category.deleted',
  'attribute.created',
  'attribute.updated',
  'attribute.deleted',
  'attribute_value.created',
  'attribute_value.updated',
  'attribute_value.deleted',
  'moderation.approved',
  'moderation.rejected',
  'agency_review.approved',
  'agency_review.rejected',
  'agency_review.info_requested',
] as const

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number]

export const ADMIN_AUDIT_TARGET_TYPES = [
  'user',
  'category',
  'attribute',
  'attribute_value',
  'organization',
  'product',
] as const

export type AdminAuditTargetType = (typeof ADMIN_AUDIT_TARGET_TYPES)[number]

/**
 * Valeurs avant/après d'une modification. Les clés sont les champs touchés ;
 * jamais de secret (mot de passe, jeton).
 */
export type AdminAuditChanges = {
  before?: Record<string, string | number | boolean | null>
  after?: Record<string, string | number | boolean | null>
  /** Origine hors interface web (commande ace). */
  source?: 'cli'
}

/**
 * Auteur d'une action tracée : le strict nécessaire pour l'instantané du
 * journal (`User` y satisfait structurellement).
 */
export type AdminActor = {
  id: number
  email: string
}

/**
 * Contexte d'une action admin transmis du contrôleur au service : qui agit et
 * d'où. `actor: null` pour une action hors interface web (commande ace).
 */
export type AdminActionContext = {
  actor: AdminActor | null
  ip: string | null
}

export type AdminAuditEntry = {
  action: AdminAuditAction
  targetType: AdminAuditTargetType
  targetId: number
  changes?: AdminAuditChanges
}

export type AdminAuditFilters = {
  action: AdminAuditAction | null
  targetType: AdminAuditTargetType | null
  /** Recherche partielle, insensible à la casse, sur l'email de l'acteur. */
  actor: string | null
  /** Bornes incluses, au format `AAAA-MM-JJ`. */
  from: string | null
  to: string | null
}

/**
 * DTO déclaré en `type` pour rester assignable aux props Inertia.
 */
export type AdminAuditLogItem = {
  id: number
  action: AdminAuditAction
  actorEmail: string | null
  targetType: AdminAuditTargetType | null
  targetId: number | null
  changes: AdminAuditChanges | null
  ipAddress: string | null
  createdAt: string
}
