import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import NotificationService from '#services/notification_service'
import NotificationTransformer from '#transformers/notification_transformer'
import type { Locale } from '#shared/types/i18n'

@inject()
export default class NotificationsController {
  constructor(private service: NotificationService) {}

  /** Toutes les notifications récentes de l'utilisateur, lues ou non. */
  async index({ auth, inertia, i18n }: HttpContext) {
    const locale = i18n.locale as Locale
    const notifications = await this.service.listFor(auth.getUserOrFail())

    return inertia.render('notifications/index', {
      notifications: notifications.map((notification) =>
        new NotificationTransformer(notification, locale).toObject()
      ),
    })
  }

  /**
   * Marque la notification comme lue puis ouvre l'écran qu'elle concerne :
   * cliquer sur une notification, c'est la lire et aller voir. Une notification
   * d'un autre utilisateur donne une 404.
   */
  async read({ auth, params, response, i18n }: HttpContext) {
    const notification = await this.service.markRead(auth.getUserOrFail(), Number(params.id))
    const { href } = new NotificationTransformer(notification, i18n.locale as Locale).toObject()

    return response.redirect().withQs(false).toPath(href)
  }

  async readAll({ auth, response }: HttpContext) {
    await this.service.markAllRead(auth.getUserOrFail())

    return response.redirect().back()
  }
}
