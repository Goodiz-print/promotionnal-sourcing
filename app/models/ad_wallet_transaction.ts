import { AdWalletTransactionSchema } from '#database/schema'
import type { AdTransactionType } from '#shared/types/ads'

/** Mouvement d'un portefeuille publicitaire. En ajout seul. */
export default class AdWalletTransaction extends AdWalletTransactionSchema {
  static table = 'ad_wallet_transactions'

  declare type: AdTransactionType
}
