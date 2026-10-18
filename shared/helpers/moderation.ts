import type { ModerationTargetType } from '#shared/types/moderation'

/**
 * Fragment SQL `EXISTS` : la **dernière** décision de modération de la cible est
 * un rejet. Une cible sans décision ne correspond pas (`pending` est visible).
 *
 * `idColumn` est une référence de colonne interne au code (ex. `products.id`),
 * jamais une entrée utilisateur. `targetType` est typé par une liste fermée.
 */
export function latestDecisionIsRejectedSql(
  targetType: ModerationTargetType,
  idColumn: string
): string {
  return `EXISTS (
    SELECT 1 FROM moderation_decisions md
    WHERE md.target_type = '${targetType}' AND md.target_id = ${idColumn}
      AND md.status = 'rejected'
      AND md.id = (
        SELECT m.id FROM moderation_decisions m
        WHERE m.target_type = '${targetType}' AND m.target_id = ${idColumn}
        ORDER BY m.decided_at DESC, m.id DESC LIMIT 1
      )
  )`
}
