import env from '#start/env'
import type { InboundMailProviderName } from '#shared/types/inbound_mail'

/**
 * Réception des mails entrants (cf. `docs/mail.md`, ADR 0005). **Désactivée**
 * tant que le prestataire, le domaine relais et les deux clés ne sont pas tous
 * renseignés (dev, test, CI) : les mails de demande partent alors sans
 * `Reply-To` et le webhook répond 503.
 */
const provider: InboundMailProviderName = env.get('INBOUND_MAIL_PROVIDER') ?? 'none'
const domain = env.get('INBOUND_MAIL_DOMAIN')?.toLowerCase() ?? null
const signingKey = env.get('INBOUND_MAIL_SIGNING_KEY')?.release() ?? null
const apiKey = env.get('INBOUND_MAIL_API_KEY')?.release() ?? null

const MEGABYTE = 1024 * 1024

const inboundMailConfig = {
  enabled: provider !== 'none' && Boolean(domain && signingKey && apiKey),
  provider,
  /** Domaine des adresses relais (`rfq-<jeton>@<domaine>`), MX chez le prestataire. */
  domain,
  signingKey,
  apiKey,
  /** Taille maximale d'un mail, pièces jointes comprises. */
  maxSizeBytes: (env.get('INBOUND_MAIL_MAX_SIZE_MB') ?? 25) * MEGABYTE,
  /** Taille maximale d'une pièce jointe stockée. */
  maxAttachmentSizeBytes: (env.get('INBOUND_MAIL_MAX_ATTACHMENT_SIZE_MB') ?? 15) * MEGABYTE,
  /** Jours pendant lesquels l'adresse relais reste valide après la clôture ou l'expiration. */
  graceDays: env.get('INBOUND_MAIL_GRACE_DAYS') ?? 30,
  /**
   * Minutes sans mouvement après lesquelles un mail non abouti est repris : le
   * verrou `processing` d'un worker tué, ou un mail dont le job a épuisé ses
   * tentatives. Supérieur au plus long délai entre deux tentatives du job.
   */
  staleAfterMinutes: 15,
  /** Heures pendant lesquelles un mail non abouti est repris après sa réception. */
  recoveryWindowHours: 24,
  /** Écart d'horodatage toléré sur un webhook signé (anti-rejeu). */
  signatureToleranceSeconds: 300,
}

export default inboundMailConfig
