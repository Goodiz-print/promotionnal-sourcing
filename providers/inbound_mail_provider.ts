import type { ApplicationService } from '@adonisjs/core/types'
import inboundMailConfig from '#config/inbound_mail'
import InboundMailProvider from '#services/inbound_mail/inbound_mail_provider'
import NullInboundMailProvider from '#services/inbound_mail/null_inbound_mail_provider'
import ResendInboundMailProvider from '#services/inbound_mail/resend_inbound_mail_provider'

/**
 * Lie le prestataire de réception des mails entrants (ADR 0005) : Resend quand
 * la réception est configurée, prestataire inerte sinon (dev, test, CI).
 */
export default class InboundMailServiceProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(InboundMailProvider, async (resolver) => {
      return resolver.make(
        inboundMailConfig.enabled && inboundMailConfig.provider === 'resend'
          ? ResendInboundMailProvider
          : NullInboundMailProvider
      )
    })
  }
}
