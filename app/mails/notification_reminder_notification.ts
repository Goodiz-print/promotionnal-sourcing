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

  /** Texte de la notification, tel que la cloche l'affiche. */
  get notificationMessage(): string {
    return this.i18n.t(`notifications.types.${this.notificationType}`, this.notificationData)
  }

  prepare() {
    this.message.to(this.email).subject(this.t('emails.notificationReminder.subject'))
    this.htmlViewIn('emails/notification_reminder', {
      message: this.notificationMessage,
      path: this.path,
    })
  }
}
