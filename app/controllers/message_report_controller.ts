import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import MessageReportService from '#services/message_report_service'
import { reportMessageValidator } from '#validators/message_report'

/**
 * Signalement d'un message par un participant du fil (#167). Le signalement
 * part d'un message précis : l'accès au fil est vérifié par le service.
 */
@inject()
export default class MessageReportController {
  constructor(private service: MessageReportService) {}

  async store({ auth, request, response, params, session, i18n }: HttpContext) {
    const payload = await request.validateUsing(reportMessageValidator)
    const report = await this.service.report(auth.getUserOrFail(), Number(params.id), payload)

    // Déjà traité par la plateforme : on ne prétend pas avoir transmis un nouveau signalement.
    const key = report.status === 'open' ? 'reported' : 'alreadyHandled'
    session.flash('success', i18n.t(`messaging.flash.${key}`))
    return response.redirect().back()
  }
}
