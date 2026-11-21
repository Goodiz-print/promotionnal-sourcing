import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { ConversationBlockedException } from '#exceptions/messaging_errors'
import OrganizationContextService from '#services/organization_context_service'
import RfqThreadService from '#services/rfq_thread_service'
import { rfqMessageValidator } from '#validators/rfq_message'

/**
 * Le fournisseur écrit à l'agence depuis une demande reçue (#226). Le message
 * entre dans le fil puis est transmis à l'agence par mail, comme une réponse
 * par mail (#225). Une demande qui ne lui est pas adressée est un 404 ;
 * l'autorisation est `canMessageRfqBuyer`.
 */
@inject()
export default class SupplierRfqMessagesController {
  constructor(
    private threads: RfqThreadService,
    private organizations: OrganizationContextService
  ) {}

  async store({ auth, bouncer, request, response, params, session, i18n }: HttpContext) {
    const user = auth.getUserOrFail()
    const org = await this.organizations.currentFor(user)
    const recipient = await this.threads.recipientForSupplier(Number(params.id), org.id)
    await bouncer.authorize('canMessageRfqBuyer', recipient)

    const { body } = await request.validateUsing(rfqMessageValidator)
    try {
      await this.threads.post(recipient, user, { body, side: 'supplier' })
      session.flash('success', i18n.t('messaging.flash.posted'))
    } catch (error) {
      if (!(error instanceof ConversationBlockedException)) throw error
      session.flash('error', i18n.t('messaging.errors.blocked'))
    }
    return response.redirect().back()
  }
}
