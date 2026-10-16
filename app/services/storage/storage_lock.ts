import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Verrou consultatif (relâché au commit/rollback) sur une clé de stockage.
 * Sérialise les décisions « cet objet existe / peut être supprimé » : sans lui,
 * un envoi concurrent du même contenu pourrait voir son objet supprimé par un
 * job de purge entre la vérification et le `DELETE`.
 */
export async function lockStorageKey(trx: TransactionClientContract, key: string): Promise<void> {
  await trx.rawQuery('select pg_advisory_xact_lock(hashtext(?))', [key])
}
