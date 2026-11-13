import { createHmac, timingSafeEqual } from 'node:crypto'
import { InboundMailSignatureException } from '#exceptions/inbound_mail_errors'

interface SvixSignedRequest {
  /** Secret du webhook, `whsec_<base64>`. */
  secret: string
  id: string | undefined
  timestamp: string | undefined
  /** En-tête `svix-signature` : `v1,<base64>` répété, séparé par des espaces. */
  signature: string | undefined
  rawBody: string
  toleranceSeconds: number
  now?: Date
}

/**
 * Vérifie la signature Svix d'un webhook (Resend signe ainsi les siens) :
 * HMAC-SHA256 de `<id>.<timestamp>.<corps brut>` avec le secret décodé en
 * base64, comparé en temps constant à chaque signature `v1` de l'en-tête.
 * L'horodatage borne le rejeu d'une requête interceptée.
 *
 * Lève `InboundMailSignatureException` ; ne renvoie rien si la requête est
 * authentique.
 */
export function verifySvixSignature(request: SvixSignedRequest): void {
  const { secret, id, timestamp, signature, rawBody, toleranceSeconds } = request
  if (!id || !timestamp || !signature) {
    throw new InboundMailSignatureException('missing signature headers')
  }

  const sentAt = Number(timestamp)
  const now = (request.now ?? new Date()).getTime() / 1000
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > toleranceSeconds) {
    throw new InboundMailSignatureException('timestamp outside tolerance')
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest()

  const authentic = signature.split(' ').some((candidate) => {
    const [version, value] = candidate.split(',')
    if (version !== 'v1' || !value) return false
    const received = Buffer.from(value, 'base64')
    return received.length === expected.length && timingSafeEqual(received, expected)
  })

  if (!authentic) throw new InboundMailSignatureException()
}

/** Signe un corps comme le ferait Svix (commande de simulation, tests). */
export function svixSignature(secret: string, id: string, timestamp: string, rawBody: string) {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const digest = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64')
  return `v1,${digest}`
}
