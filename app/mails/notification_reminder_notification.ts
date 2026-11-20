import logger from '@adonisjs/core/services/logger'
import LocalizedMail from '#mails/localized_mail'
import type { Locale } from '#shared/types/i18n'
import type { NotificationData, NotificationType } from '#shared/types/notification'

/**
 * Rappel par mail d'une notification in-app importante restée non lue (#243,
 * `NotificationReminderService`). Générique : le message est celui de la
 * notification (`notifications.types.<type>`), rendu dans la langue du
 * destinataire ; `path` (relatif) mène à l'écran concerné.
 */
export default class NotificationReminderNotification extends LocalizedMail {
  constructor(
    private email: string,
    private notificationType: NotificationType,
    private notificationData: NotificationData,
    private path: string,
    locale: Locale
  ) {
    super(locale)
  }

  /**
   * Texte de la notification, tel que la cloche l'affiche. `null` si le libellé
   * manque ou ne peut pas être formaté (paramètre ICU absent de `data`) : le mail part
   * alors sans ce texte, avec son lien, plutôt que d'échouer à chaque tentative.
   */
  get notificationMessage(): string | null {
    const key = `notifications.types.${this.notificationType}`
    if (!this.i18n.hasMessage(key) && !this.i18n.hasFallbackMessage(key)) return null
    try {
      return this.i18n.formatMessage(key, this.notificationData)
    } catch (error) {
      logger.warn(
        { err: error, notificationType: this.notificationType },
        'notification reminder message could not be formatted'
      )
      return null
    }
  }

  prepare() {
    this.message.to(this.email).subject(this.t('emails.notificationReminder.subject'))
    this.htmlViewIn('emails/notification_reminder', {
      message: this.notificationMessage,
      path: this.path,
    })
  }
}
