import type {
  InboundMailContent,
  InboundMailNotification,
  InboundWebhookHeaders,
} from '#shared/types/inbound_mail'

/**
 * Prestataire de réception des mails entrants (ADR 0005). Classe abstraite =
 * jeton d'injection ; l'implémentation est liée dans
 * `providers/inbound_mail_provider.ts` (Resend, ou inerte sans configuration).
 */
export default abstract class InboundMailProvider {
  /** Nom stocké dans `inbound_mails.provider`. */
  abstract readonly name: string

  /**
   * Authentifie une requête de webhook sur son **corps brut** et renvoie le mail
   * qu'elle annonce, ou `null` si elle ne concerne pas un mail reçu. Lève
   * `InboundMailSignatureException` si la signature est absente, fausse ou trop
   * ancienne.
   */
  abstract parseWebhook(
    rawBody: string,
    headers: InboundWebhookHeaders
  ): InboundMailNotification | null

  /** Corps, en-têtes et description des pièces jointes d'un mail reçu. */
  abstract fetchContent(providerMessageId: string): Promise<InboundMailContent>

  /** Contenu d'une pièce jointe. */
  abstract fetchAttachment(providerMessageId: string, attachmentId: string): Promise<Buffer>
}
