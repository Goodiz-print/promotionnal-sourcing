import { BaseTransformer } from '@adonisjs/core/transformers'
import type AdWalletTransaction from '#models/ad_wallet_transaction'
import type { AdWalletTransactionType } from '#shared/types/ads'

export default class AdWalletTransactionTransformer extends BaseTransformer<AdWalletTransaction> {
  toObject(): AdWalletTransactionType {
    return {
      ...this.pick(this.resource, ['type', 'amountCents', 'balanceAfterCents', 'note']),
      id: Number(this.resource.id),
      createdAt: this.resource.createdAt.toISO()!,
    }
  }
}
