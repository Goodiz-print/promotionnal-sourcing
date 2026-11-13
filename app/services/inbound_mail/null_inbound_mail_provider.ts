import InboundMailProvider from '#services/inbound_mail/inbound_mail_provider'
import { InboundMailUnavailableException } from '#exceptions/inbound_mail_errors'
import type { InboundMailContent, InboundMailNotification } from '#shared/types/inbound_mail'

/** Prestataire inerte : la réception n'est pas configurée (dev, test, CI). */
export default class NullInboundMailProvider extends InboundMailProvider {
  readonly name = 'none'

  parseWebhook(): InboundMailNotification | null {
    throw new InboundMailUnavailableException()
  }

  async fetchContent(): Promise<InboundMailContent> {
    throw new InboundMailUnavailableException()
  }

  async fetchAttachment(): Promise<Buffer> {
    throw new InboundMailUnavailableException()
  }
}
