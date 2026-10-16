import { Job, exponentialBackoff } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import type { BaseMail } from '@adonisjs/mail'
import mail from '@adonisjs/mail/services/main'
import logger from '@adonisjs/core/services/logger'
import OrganizationInvitationNotification from '#mails/organization_invitation_notification'
import EmailVerificationNotification from '#mails/email_verification_notification'
import PasswordResetNotification from '#mails/password_reset_notification'
import RfqReceivedNotification from '#mails/rfq_received_notification'
import { UnknownMailKindException } from '#exceptions/mail_errors'
import { MAIL_KINDS, type SendMailPayload } from '#shared/types/mail'

/**
 * Envoi d'un mail transactionnel **par la queue AdonisJS** (table `queue_jobs`)
 * plutôt que par la file mémoire de `@adonisjs/mail` (`mail.sendLater()`), qui
 * perd tout au redémarrage du process et n'offre ni reprise sur erreur ni trace.
 *
 * Le job appelle donc `mail.send()` — envoi **synchrone côté worker** : la file,
 * c'est la queue. Un SMTP indisponible fait échouer le job, qui est rejoué avec
 * un backoff exponentiel ; après épuisement des tentatives, `failed()` loggue le
 * destinataire et le type de mail, et l'enregistrement est conservé 30 jours
 * dans `queue_jobs` (`removeOnFail`) pour inspection / rejeu manuel.
 *
 * ⚠️ Pas de dédoublonnage : si l'échec survient *après* la remise SMTP, le rejeu
 * renvoie le mail. Bénin pour une invitation ; à revoir pour devis / commandes.
 *
 * Note DI : `mail` est un **service singleton du framework**, importable au
 * sommet du module (ce n'est pas un `new`). La contrainte « pas de modèle Lucid
 * importé statiquement dans un job » est respectée — les classes de mail
 * n'importent les modèles qu'en `import type` (effacé à la compilation).
 */
export default class SendMailJob extends Job<SendMailPayload> {
  static options: JobOptions = {
    queue: 'default',
    retry: {
      maxRetries: 5,
      backoff: exponentialBackoff({ baseDelay: '30s', maxDelay: '15m' }),
    },
    removeOnFail: { age: '30d' },
  }

  async execute() {
    await mail.send(this.buildMail())
  }

  async failed(error: Error) {
    logger.error(
      { err: error, to: this.payload.to, kind: this.payload.kind },
      'transactional mail permanently failed'
    )
  }

  /**
   * Reconstruit la classe de mail à partir de la charge sérialisée. Le `switch`
   * est exhaustif : ajouter un `kind` dans `MAIL_KINDS` sans le traiter ici est
   * une erreur de compilation (`never`).
   */
  private buildMail(): BaseMail {
    const { kind, to, data } = this.payload

    switch (kind) {
      case MAIL_KINDS.organizationInvitation:
        return new OrganizationInvitationNotification(
          to,
          data.organizationName,
          data.roleName,
          data.inviterName,
          data.acceptUrl
        )
      case MAIL_KINDS.rfqReceived:
        return new RfqReceivedNotification(
          to,
          data.buyerName,
          data.rfqTitle,
          data.itemCount,
          data.deadline,
          data.rfqPath
        )
      case MAIL_KINDS.passwordReset:
        return new PasswordResetNotification(to, data.resetUrl, data.expiresInMinutes)
      case MAIL_KINDS.emailVerification:
        return new EmailVerificationNotification(to, data.verifyUrl, data.expiresInHours)
      default:
        throw new UnknownMailKindException(kind)
    }
  }
}
