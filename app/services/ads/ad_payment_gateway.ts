import type { AdCheckoutRequest, AdPaymentConfirmation } from '#shared/types/ads'

/**
 * Prestataire de paiement des recharges de portefeuille publicitaire. Classe
 * abstraite = jeton d'injection ; l'implémentation est liée dans
 * `providers/ads_provider.ts` (Stripe, ou inerte sans clé).
 */
export default abstract class AdPaymentGateway {
  /** `false` pour le prestataire inerte (pas de `STRIPE_SECRET_KEY`). */
  abstract readonly enabled: boolean

  /**
   * Ouvre une session de paiement hébergée et renvoie son URL : l'acheteur y
   * saisit sa carte, jamais sur la plateforme.
   */
  abstract createCheckout(request: AdCheckoutRequest): Promise<string>

  /**
   * Lit une notification du prestataire. Renvoie le paiement **confirmé** qu'elle
   * annonce, ou `null` si elle ne concerne pas une recharge payée. Lève si la
   * signature est invalide.
   */
  abstract confirmFromWebhook(
    rawBody: string,
    signature: string | undefined
  ): Promise<AdPaymentConfirmation | null>
}
