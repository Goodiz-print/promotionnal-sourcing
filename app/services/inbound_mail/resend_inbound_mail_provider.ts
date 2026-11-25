import inboundMailConfig from '#config/inbound_mail'
import InboundMailProvider from '#services/inbound_mail/inbound_mail_provider'
import { verifySvixSignature } from '#services/inbound_mail/svix_signature'
import {
  InboundMailProviderException,
  InboundMailUnavailableException,
} from '#exceptions/inbound_mail_errors'
import { parseRawHeaders } from '#shared/helpers/inbound_mail'
import type {
  InboundAttachmentDescriptor,
  InboundMailContent,
  InboundMailNotification,
  InboundWebhookHeaders,
} from '#shared/types/inbound_mail'

const API = 'https://api.resend.com'
const RECEIVED_EVENT = 'email.received'
/**
 * Début du mail d'origine lu pour ses en-têtes. Large : les en-têtes `Received`,
 * `DKIM-Signature` et `ARC-*` d'un mail relayé plusieurs fois pèsent lourd.
 */
const RAW_HEAD_BYTES = 256 * 1024

/** Événement `email.received` : métadonnées seules. */
interface ResendReceivedEvent {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    created_at?: string
    from?: string
    to?: string[]
    cc?: string[]
    bcc?: string[]
    received_for?: string[]
    message_id?: string
    subject?: string
  }
}

interface ResendAttachment {
  id: string
  filename?: string | null
  content_type?: string | null
  content_disposition?: string | null
  content_id?: string | null
  size?: number | null
  download_url?: string
}

/** Réponse de `GET /emails/receiving/:id`. */
interface ResendReceivedEmail {
  html?: string | null
  text?: string | null
  headers?: Record<string, string> | null
  raw?: { download_url?: string } | null
  attachments?: ResendAttachment[] | null
}

/**
 * Réception par **Resend** (ADR 0005). Le webhook `email.received`, signé par
 * Svix, n'annonce que des métadonnées : le corps, les en-têtes et les pièces
 * jointes sont lus ensuite par l'API (`/emails/receiving/…`), depuis le worker.
 *
 * En-têtes : la réponse de l'API n'en garantit qu'un sous-ensemble. Quand le
 * mail d'origine (`raw.download_url`, fichier `.eml`) est disponible, ses
 * en-têtes complètent ceux de l'API — le filtrage des réponses automatiques en
 * dépend (`Auto-Submitted`, `Precedence`). Seul le début du fichier est lu
 * (`RAW_HEAD_BYTES`) : un mail de 40 Mo n'est jamais chargé en mémoire, sa
 * taille vient des en-têtes de la réponse HTTP.
 */
export default class ResendInboundMailProvider extends InboundMailProvider {
  readonly name = 'resend'

  parseWebhook(rawBody: string, headers: InboundWebhookHeaders): InboundMailNotification | null {
    const secret = inboundMailConfig.signingKey
    if (!secret) throw new InboundMailUnavailableException()

    verifySvixSignature({
      secret,
      id: single(headers['svix-id']),
      timestamp: single(headers['svix-timestamp']),
      signature: single(headers['svix-signature']),
      rawBody,
      toleranceSeconds: inboundMailConfig.signatureToleranceSeconds,
    })

    const event = JSON.parse(rawBody) as ResendReceivedEvent
    const data = event.data
    if (event.type !== RECEIVED_EVENT || !data?.email_id || !data.from) return null

    return {
      providerMessageId: data.email_id,
      recipients: [
        ...(data.received_for ?? []),
        ...(data.to ?? []),
        ...(data.cc ?? []),
        ...(data.bcc ?? []),
      ],
      from: data.from,
      subject: data.subject ?? null,
      messageId: data.message_id ?? null,
      receivedAt: data.created_at ?? event.created_at ?? new Date().toISOString(),
    }
  }

  async fetchContent(providerMessageId: string): Promise<InboundMailContent> {
    const email = await this.getJson<ResendReceivedEmail>(
      `/emails/receiving/${encodeURIComponent(providerMessageId)}`,
      'retrieve email'
    )

    const raw = email.raw?.download_url
      ? await this.downloadHead(email.raw.download_url, 'download raw email')
      : null

    return {
      text: email.text ?? null,
      html: email.html ?? null,
      headers: {
        ...lowercaseKeys(email.headers ?? {}),
        ...(raw ? parseRawHeaders(raw.head.toString('latin1')) : {}),
      },
      sizeBytes: raw?.totalBytes ?? null,
      attachments: (email.attachments ?? []).map(toDescriptor),
    }
  }

  /**
   * L'URL de téléchargement expire au bout d'une heure : elle est redemandée à
   * chaque appel plutôt que conservée d'une tentative du job à l'autre.
   */
  async fetchAttachment(providerMessageId: string, attachmentId: string): Promise<Buffer> {
    const attachment = await this.getJson<ResendAttachment>(
      `/emails/receiving/${encodeURIComponent(providerMessageId)}/attachments/${encodeURIComponent(attachmentId)}`,
      'retrieve attachment'
    )
    if (!attachment.download_url) {
      throw new InboundMailProviderException('retrieve attachment', 404)
    }
    return this.download(attachment.download_url, 'download attachment')
  }

  private async getJson<T>(path: string, operation: string): Promise<T> {
    const apiKey = inboundMailConfig.apiKey
    if (!apiKey) throw new InboundMailUnavailableException()

    const response = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    })
    if (!response.ok) throw new InboundMailProviderException(operation, response.status)
    return (await response.json()) as T
  }

  /** URL signée par le prestataire : pas d'en-tête d'authentification. */
  private async download(url: string, operation: string): Promise<Buffer> {
    const response = await fetch(url)
    if (!response.ok) throw new InboundMailProviderException(operation, response.status)
    return Buffer.from(await response.arrayBuffer())
  }

  /**
   * Les `RAW_HEAD_BYTES` premiers octets d'un fichier et sa taille totale. La
   * tranche est demandée par `Range` ; si le serveur l'ignore et renvoie tout
   * le fichier, la lecture est interrompue une fois la tranche obtenue.
   */
  private async downloadHead(
    url: string,
    operation: string
  ): Promise<{ head: Buffer; totalBytes: number | null }> {
    const response = await fetch(url, { headers: { Range: `bytes=0-${RAW_HEAD_BYTES - 1}` } })
    if (!response.ok) throw new InboundMailProviderException(operation, response.status)

    const chunks: Uint8Array[] = []
    let read = 0
    const reader = response.body?.getReader()
    while (reader && read < RAW_HEAD_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      read += value.length
    }
    await reader?.cancel()

    return {
      head: Buffer.concat(chunks).subarray(0, RAW_HEAD_BYTES),
      totalBytes: totalBytesOf(response),
    }
  }
}

/** Taille du fichier entier : `Content-Range` d'une tranche (206), sinon `Content-Length`. */
function totalBytesOf(response: Response): number | null {
  const header =
    response.status === 206
      ? response.headers.get('content-range')?.match(/\/(\d+)\s*$/)?.[1]
      : response.headers.get('content-length')
  const total = Number(header)
  return header && Number.isFinite(total) ? total : null
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function lowercaseKeys(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value)])
  )
}

function toDescriptor(attachment: ResendAttachment): InboundAttachmentDescriptor {
  return {
    id: attachment.id,
    filename: attachment.filename || 'attachment',
    contentType: attachment.content_type ?? null,
    sizeBytes: attachment.size ?? null,
    inline: attachment.content_disposition === 'inline' && Boolean(attachment.content_id),
  }
}
