import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { ConversationBlockedException } from '#exceptions/messaging_errors'
import OrganizationContextService from '#services/organization_context_service'
import RfqThreadService from '#services/rfq_thread_service'
import { rfqMessageValidator } from '#validators/rfq_message'

/**
 * L'agence écrit au fournisseur depuis le détail de sa demande (#226). Le
 * message entre dans le fil du destinataire puis lui est relayé par mail,
 * anonyme pour un fournisseur non abonné. Autorisation : `canMessageRfqSupplier`.
 */
@inject()
export default class RfqMessagesController {
  constructor(
    private threads: RfqThreadService,
    private organizations: OrganizationContextService
  ) {}

  async store({ auth, bouncer, request, response, params, session, i18n }: HttpContext) {
    const user = auth.getUserOrFail()
    const org = await this.organizations.currentFor(user)
    const recipient = await this.threads.recipientForBuyer(
      Number(params.id),
      Number(params.supplierId),
      org.id
    )
    await bouncer.authorize('canMessageRfqSupplier', recipient.rfq, recipient)

    const { body } = await request.validateUsing(rfqMessageValidator)
    try {
      await this.threads.post(recipient, user, { body, side: 'agency' })
      session.flash('success', i18n.t('messaging.flash.posted'))
    } catch (error) {
      if (!(error instanceof ConversationBlockedException)) throw error
      session.flash('error', i18n.t('messaging.errors.blocked'))
    }
    return response.redirect().back()
  }
}
