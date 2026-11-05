import { Job, exponentialBackoff } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import type { BaseMail } from '@adonisjs/mail'
import mail from '@adonisjs/mail/services/main'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'
import emitter from '@adonisjs/core/services/emitter'
import MailDeliveryService from '#services/mail_delivery_service'
import MailDeliveryFailed from '#events/mail_delivery_failed'
import AgencyReviewDecisionNotification from '#mails/agency_review_decision_notification'
import AnnouncementNotification from '#mails/announcement_notification'
import OrganizationInvitationNotification from '#mails/organization_invitation_notification'
import ContactRequestNotification from '#mails/contact_request_notification'
import EmailVerificationNotification from '#mails/email_verification_notification'
import PasswordResetNotification from '#mails/password_reset_notification'
import QuoteReceivedNotification from '#mails/quote_received_notification'
import RfqReceivedNotification from '#mails/rfq_received_notification'
import RfqReminderNotification from '#mails/rfq_reminder_notification'
import { UnknownMailKindException } from '#exceptions/mail_errors'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
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
 * **Idempotence** (#59) : la charge porte une `idempotencyKey`, réservée dans
 * `mail_deliveries` (`INSERT … ON CONFLICT DO NOTHING`) avant l'envoi. Une clé
 * déjà `sent` sort sans rien envoyer : un rejeu après un échec *postérieur* à la
 * remise SMTP ne renvoie pas le mail. Un échec définitif laisse la ligne en
 * `failed` (dead-letter, rejouable par `node ace mail:retry`) et émet
 * `MailDeliveryFailed`.
 *
 * Limite : une erreur levée *par* `mail.send()` est indiscernable d'un mail non
 * remis ; le rejeu renvoie alors le mail (mieux vaut un doublon qu'une perte).
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
    const payload = this.resolvedPayload()
    const deliveries = await app.container.make(MailDeliveryService)

    if (!(await deliveries.begin(payload))) {
      logger.info(
        { idempotencyKey: payload.idempotencyKey, kind: payload.kind },
        'transactional mail already sent, skipping'
      )
      return
    }

    try {
      await mail.send(this.buildMail(payload))
    } catch (error) {
      await deliveries.markFailed(payload, error as Error)
      throw error
    }

    // Le mail est parti : ne jamais faire échouer (donc rejouer) le job pour un
    // simple défaut de traçabilité.
    try {
      await deliveries.markSent(payload.idempotencyKey)
    } catch (error) {
      logger.error(
        { err: error, idempotencyKey: payload.idempotencyKey },
        'mail sent but delivery could not be marked as sent'
      )
    }
  }

  async failed(error: Error) {
    const payload = this.resolvedPayload()
    logger.error(
      { err: error, to: payload.to, kind: payload.kind, idempotencyKey: payload.idempotencyKey },
      'transactional mail permanently failed'
    )

    try {
      const deliveries = await app.container.make(MailDeliveryService)
      await deliveries.markFailed(payload, error)
      const attempts = await deliveries.attemptsFor(payload.idempotencyKey)
      await emitter.emit(
        MailDeliveryFailed,
        new MailDeliveryFailed({
          idempotencyKey: payload.idempotencyKey,
          kind: payload.kind,
          to: payload.to,
          error: error.message,
          attempts,
        })
      )
    } catch (dlqError) {
      logger.error({ err: dlqError }, 'could not record mail dead-letter')
    }
  }

  /**
   * Jobs mis en queue avant #59 n'ont pas de clé : on retombe sur l'id du job,
   * stable d'une tentative à l'autre (le dédoublonnage couvre alors les rejeux).
   */
  private resolvedPayload(): SendMailPayload {
    const stored = this.payload as { idempotencyKey?: string; locale?: Locale }
    return {
      ...this.payload,
      // Jobs mis en queue avant #58 : pas de langue, on retombe sur la défaut.
      locale: stored.locale ?? DEFAULT_LOCALE,
      idempotencyKey: stored.idempotencyKey ?? `legacy:${this.context.jobId}`,
    }
  }

  /**
   * Reconstruit la classe de mail à partir de la charge sérialisée. Le `switch`
   * est exhaustif : ajouter un `kind` dans `MAIL_KINDS` sans le traiter ici est
   * une erreur de compilation (`never`).
   */
  private buildMail(payload: SendMailPayload): BaseMail {
    const { kind, to, data, locale } = payload

    switch (kind) {
      case MAIL_KINDS.organizationInvitation:
        return new OrganizationInvitationNotification(
          to,
          data.organizationName,
          data.roleName,
          data.inviterName,
          data.acceptUrl,
          locale
        )
      case MAIL_KINDS.rfqReceived:
        return new RfqReceivedNotification(
          to,
          data.buyerName,
          data.rfqTitle,
          data.itemCount,
          data.deadline,
          data.rfqPath,
          locale
        )
      case MAIL_KINDS.rfqReminder:
        return new RfqReminderNotification(
          to,
          data.buyerName,
          data.rfqTitle,
          data.deadline,
          data.rfqPath,
          locale
        )
      case MAIL_KINDS.quoteReceived:
        return new QuoteReceivedNotification(
          to,
          data.supplierName,
          data.rfqTitle,
          data.total,
          data.quotePath,
          locale
        )
      case MAIL_KINDS.passwordReset:
        return new PasswordResetNotification(to, data.resetUrl, data.expiresInMinutes, locale)
      case MAIL_KINDS.emailVerification:
        return new EmailVerificationNotification(to, data.verifyUrl, data.expiresInHours, locale)
      case MAIL_KINDS.agencyReviewDecision:
        return new AgencyReviewDecisionNotification(
          to,
          data.organizationName,
          data.decision,
          data.reason,
          locale
        )
      case MAIL_KINDS.announcement:
        return new AnnouncementNotification(to, data.title, data.body, locale)
      case MAIL_KINDS.contactRequest:
        return new ContactRequestNotification(to, data)
      default:
        throw new UnknownMailKindException(kind)
    }
  }
}
