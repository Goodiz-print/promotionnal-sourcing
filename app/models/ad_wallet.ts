import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { AdWalletSchema } from '#database/schema'
import AdWalletTransaction from '#models/ad_wallet_transaction'
import Organization from '#models/organization'

/**
 * Portefeuille publicitaire prépayé d'une organisation fournisseuse. Le solde
 * ne se modifie que par `AdWalletService` (verrou + ligne de journal).
 */
export default class AdWallet extends AdWalletSchema {
  static table = 'ad_wallets'

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @hasMany(() => AdWalletTransaction, { foreignKey: 'walletId' })
  declare transactions: HasMany<typeof AdWalletTransaction>
}
