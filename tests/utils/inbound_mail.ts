import app from '@adonisjs/core/services/app'
import type { ApiClient } from '@japa/api-client'
import type { Group } from '@japa/runner/core'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import RfqSupplier from '#models/rfq_supplier'
import type Organization from '#models/organization'
import type Rfq from '#models/rfq'
import inboundMailConfig from '#config/inbound_mail'
import InboundMailProvider from '#services/inbound_mail/inbound_mail_provider'
import { InboundMailSignatureException } from '#exceptions/inbound_mail_errors'
import type {
  InboundAttachmentDescriptor,
  InboundMailContent,
  InboundMailNotification,
} from '#shared/types/inbound_mail'

/** Domaine relais des tests : `rfq-<jeton>@reply.test`. */
export const TEST_RELAY_DOMAIN = 'reply.test'

/** Mail tel que le faux prestataire le connaît : métadonnées, contenu et fichiers. */
export interface FakeInboundMail {
  to: string
  /** Destinataires annoncés par le webhook, si ce n'est pas `to` seul. */
  recipients?: string[]
  /** Date de réception annoncée, si ce n'est pas l'instant présent en ISO. */
  receivedAt?: string
  from?: string
  subject?: string
  text?: string
  /** Corps HTML ; avec `text: ''`, simule un mail sans partie texte. */
  html?: string
  headers?: Record<string, string>
  sizeBytes?: number | null
  /** Contenu texte, ou binaire (`Buffer`) pour un vrai PDF. */
  attachments?: Array<
    Partial<InboundAttachmentDescriptor> & { filename: string; content?: string | Buffer }
  >
}

/**
 * Prestataire de réception factice. Le corps du webhook est l'identifiant du
 * mail ; l'en-tête `x-test-signature: valid` tient lieu de signature. Compte
 * les lectures de contenu, pour vérifier qu'un mail n'est traité qu'une fois.
 */
export class FakeInboundMailProvider extends InboundMailProvider {
  readonly name = 'fake'
  readonly mails = new Map<string, FakeInboundMail>()
  contentFetches = 0
  attachmentFetches = 0
  /** Erreur levée par `fetchContent` (prestataire indisponible). */
  failure: Error | null = null

  /** Enregistre un mail et renvoie son identifiant (le corps du webhook). */
  add(id: string, mail: FakeInboundMail): string {
    this.mails.set(id, mail)
    return id
  }

  parseWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>
  ): InboundMailNotification | null {
    if (headers['x-test-signature'] !== 'valid') throw new InboundMailSignatureException()

    const { id } = JSON.parse(rawBody) as { id: string }
    const mail = this.mails.get(id)
    if (!mail) return null

    return {
      providerMessageId: id,
      recipients: mail.recipients ?? [mail.to],
      from: mail.from ?? 'Jean Dupont <jean@fournisseur.test>',
      subject: mail.subject ?? 'Re: demande de devis',
      messageId: `<${id}@fournisseur.test>`,
      receivedAt: mail.receivedAt ?? new Date().toISOString(),
    }
  }

  async fetchContent(providerMessageId: string): Promise<InboundMailContent> {
    this.contentFetches += 1
    if (this.failure) throw this.failure

    const mail = this.mails.get(providerMessageId)!
    return {
      text: mail.text ?? 'Bonjour, voici notre devis.',
      html: mail.html ?? null,
      headers: mail.headers ?? {},
      sizeBytes: mail.sizeBytes ?? null,
      attachments: (mail.attachments ?? []).map((attachment, index) => ({
        id: attachment.id ?? `att-${index}`,
        filename: attachment.filename,
        contentType: attachment.contentType ?? null,
        sizeBytes: attachment.sizeBytes ?? (attachment.content ?? '').length,
        inline: attachment.inline ?? false,
      })),
    }
  }

  async fetchAttachment(providerMessageId: string, attachmentId: string): Promise<Buffer> {
    this.attachmentFetches += 1
    const attachments = this.mails.get(providerMessageId)?.attachments ?? []
    const index = attachments.findIndex((a, i) => (a.id ?? `att-${i}`) === attachmentId)
    const content = attachments[index]?.content ?? ''
    return Buffer.isBuffer(content) ? content : Buffer.from(content)
  }
}

/**
 * Active la réception le temps de chaque test du groupe : domaine relais de
 * test dans la configuration, faux prestataire dans le conteneur. Tout est
 * rétabli en fin de test.
 */
export function useFakeInboundMail(group: Group): { readonly provider: FakeInboundMailProvider } {
  const state = { provider: new FakeInboundMailProvider() }

  group.each.setup(() => {
    const previous = { ...inboundMailConfig }
    Object.assign(inboundMailConfig, { enabled: true, domain: TEST_RELAY_DOMAIN })
    state.provider = new FakeInboundMailProvider()
    app.container.swap(InboundMailProvider, () => state.provider)

    return () => {
      Object.assign(inboundMailConfig, previous)
      app.container.restore(InboundMailProvider)
    }
  })

  return {
    get provider() {
      return state.provider
    },
  }
}

/** Demande publiée, envoyée à un fournisseur : le couple visé par l'adresse relais. */
export async function sentRfq(
  rfqState: 'published' | 'expired' = 'published'
): Promise<{ rfq: Rfq; supplier: Organization; recipient: RfqSupplier; address: string }> {
  const buyer = await OrganizationFactory.create()
  const supplier = await OrganizationFactory.apply('supplier')
    .merge({ email: 'contact@fournisseur.test' })
    .create()
  const rfq = await RfqFactory.apply(rfqState).merge({ buyerOrganizationId: buyer.id }).create()
  const created = await RfqSupplierFactory.apply('sent')
    .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id })
    .create()
  // Le jeton est généré par la base : relire la ligne.
  const recipient = await RfqSupplier.findOrFail(created.id)

  return {
    rfq,
    supplier,
    recipient,
    address: `rfq-${recipient.replyToken}@${TEST_RELAY_DOMAIN}`,
  }
}

/** Le prestataire appelle le webhook : sans session ni jeton CSRF. */
export function deliver(client: ApiClient, id: string, signature = 'valid') {
  return client.post('/webhooks/inbound-mail').header('x-test-signature', signature).json({ id })
}
