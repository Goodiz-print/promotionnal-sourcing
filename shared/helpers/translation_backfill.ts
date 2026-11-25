import { TRANSLATABLE_ENTITIES, type TranslatableEntity } from '#shared/types/ai'

/**
 * Types d'entité à rattraper, dans l'ordre canonique de `TRANSLATABLE_ENTITIES`
 * quel que soit l'ordre demandé ; tous si `requested` est absent.
 */
export function selectBackfillEntities(
  requested?: readonly TranslatableEntity[]
): TranslatableEntity[] {
  if (!requested) return [...TRANSLATABLE_ENTITIES]
  return TRANSLATABLE_ENTITIES.filter((entity) => requested.includes(entity))
}

/** Compteurs de mises en file à zéro, un par type d'entité. */
export function emptyBackfillCounts(): Record<TranslatableEntity, number> {
  return Object.fromEntries(TRANSLATABLE_ENTITIES.map((entity) => [entity, 0])) as Record<
    TranslatableEntity,
    number
  >
}

/**
 * Taille du prochain lot : `batchSize`, réduite à ce qu'il reste sous `limit`
 * (jamais négative). Sans `limit`, toujours `batchSize`.
 */
export function nextBackfillBatchSize(batchSize: number, queued: number, limit?: number): number {
  if (limit === undefined) return batchSize
  return Math.max(0, Math.min(batchSize, limit - queued))
}
