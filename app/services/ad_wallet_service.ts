import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AdWallet from '#models/ad_wallet'
import AdWalletTransaction from '#models/ad_wallet_transaction'
import { InsufficientAdFundsException } from '#exceptions/ad_errors'
import type { AdTransactionType } from '#shared/types/ads'

/** Ce qui accompagne un mouvement de portefeuille. */
export interface AdWalletMovement {
  type: AdTransactionType
  /** Référence unique d'un paiement : rend le crédit idempotent. */
  externalReference?: string | null
  campaignId?: number | null
  note?: string | null
  actorId?: number | null
}

/**
 * Portefeuille publicitaire prépayé d'une organisation (cf. `docs/ads.md`).
 *
 * Seul endroit où un solde change : chaque mouvement verrouille la ligne du
 * portefeuille (`FOR UPDATE`), refuse un solde négatif et écrit une ligne dans
 * `ad_wallet_transactions`, le tout dans une même transaction.
 */
export default class AdWalletService {
  /** Solde de l'organisation, en centimes (0 sans portefeuille). */
  async balance(organizationId: number): Promise<number> {
    const wallet = await AdWallet.findBy('organizationId', organizationId)
    return wallet?.balanceCents ?? 0
  }

  /** Derniers mouvements de l'organisation, du plus récent au plus ancien. */
  async recentTransactions(organizationId: number, limit: number): Promise<AdWalletTransaction[]> {
    return AdWalletTransaction.query()
      .whereIn('walletId', AdWallet.query().select('id').where('organizationId', organizationId))
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
  }

  /**
   * Portefeuille de l'organisation, **verrouillé** jusqu'à la fin de la
   * transaction ; créé au besoin (`ON CONFLICT DO NOTHING` : deux créations
   * concurrentes ne se marchent pas dessus).
   */
  async lock(organizationId: number, trx: TransactionClientContract): Promise<AdWallet> {
    await trx.rawQuery(
      `INSERT INTO ad_wallets (organization_id, balance_cents, created_at, updated_at)
       VALUES (?, 0, NOW(), NOW())
       ON CONFLICT (organization_id) DO NOTHING`,
      [organizationId]
    )
    return AdWallet.query({ client: trx })
      .where('organizationId', organizationId)
      .forUpdate()
      .firstOrFail()
  }

  /**
   * Applique un mouvement à un portefeuille **déjà verrouillé** (`lock`) et
   * l'inscrit au journal. `amountCents` est signé. Lève
   * `InsufficientAdFundsException` si le solde deviendrait négatif.
   */
  async post(
    wallet: AdWallet,
    amountCents: number,
    movement: AdWalletMovement,
    trx: TransactionClientContract
  ): Promise<AdWalletTransaction> {
    const balance = wallet.balanceCents + amountCents
    if (balance < 0) throw new InsufficientAdFundsException()

    wallet.useTransaction(trx)
    await wallet.merge({ balanceCents: balance }).save()

    return AdWalletTransaction.create(
      {
        walletId: wallet.id,
        type: movement.type,
        amountCents,
        balanceAfterCents: balance,
        campaignId: movement.campaignId ?? null,
        externalReference: movement.externalReference ?? null,
        note: movement.note ?? null,
        createdByUserId: movement.actorId ?? null,
      },
      { client: trx }
    )
  }

  /**
   * Mouvement complet (verrou + écriture) dans sa propre transaction : recharge
   * en ligne ou ajustement manuel. Renvoie `null` si `externalReference` a déjà
   * été appliquée — un webhook de paiement rejoué ne crédite pas deux fois.
   */
  async apply(
    organizationId: number,
    amountCents: number,
    movement: AdWalletMovement
  ): Promise<AdWalletTransaction | null> {
    return db.transaction(async (trx) => {
      // Le verrou sérialise aussi deux livraisons simultanées du même paiement.
      const wallet = await this.lock(organizationId, trx)

      if (movement.externalReference) {
        const existing = await AdWalletTransaction.query({ client: trx })
          .where('externalReference', movement.externalReference)
          .first()
        if (existing) return null
      }

      return this.post(wallet, amountCents, movement, trx)
    })
  }
}
