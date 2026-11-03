/**
 * Cibles modérables. Ajouter une cible = une entrée ici ; la table ne référence
 * pas la cible par clé étrangère (polymorphe), donc aucune migration n'est requise.
 */
export const MODERATION_TARGET_TYPES = ['organization', 'product'] as const

export type ModerationTargetType = (typeof MODERATION_TARGET_TYPES)[number]

/**
 * `pending` n'est jamais écrit : c'est l'état implicite d'une cible sans
 * décision. Une décision écrite est `approved` ou `rejected`.
 */
export const MODERATION_DECISIONS = ['approved', 'rejected'] as const

export type ModerationDecision = (typeof MODERATION_DECISIONS)[number]

export type ModerationStatus = 'pending' | ModerationDecision

/**
 * Statut de modération montré à l'organisation modérée (profil fournisseur) :
 * la dernière décision et son motif éventuel.
 */
export type ModerationNotice = {
  status: ModerationStatus
  reason: string | null
}
