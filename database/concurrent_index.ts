import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { createIndexConcurrentlySql, dropIndexConcurrentlySql } from '#shared/helpers/database'
import type { ConcurrentIndex } from '#shared/types/database'

/**
 * Construit l'index `CONCURRENTLY`, depuis une migration sans transaction
 * (`static disableTransactions = true`) : la table reste ouverte en écriture.
 *
 * Une construction concurrente qui échoue laisse un index **invalide**, que
 * `IF NOT EXISTS` conserverait à la relance sans rien dire. Il est donc retiré
 * d'abord : la migration se relance telle quelle après un échec.
 */
export async function createIndexConcurrently(
  client: QueryClientContract,
  index: ConcurrentIndex
): Promise<void> {
  if (await isInvalidIndex(client, index.name)) {
    await client.rawQuery(dropIndexConcurrentlySql(index.name))
  }
  await client.rawQuery(createIndexConcurrentlySql(index))
}

/** L'index existe-t-il à l'état invalide (construction interrompue) ? */
export async function isInvalidIndex(client: QueryClientContract, name: string): Promise<boolean> {
  const result = await client.rawQuery(
    `SELECT i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = ?`,
    [name]
  )
  const [row] = result.rows as { indisvalid: boolean }[]
  return row !== undefined && !row.indisvalid
}
