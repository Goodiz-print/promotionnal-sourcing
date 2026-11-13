import { INBOUND_ATTACHMENT_TYPES, type MailAddressParts } from '../types/inbound_mail.js'

/** Préfixe de la partie locale d'une adresse relais : `rfq-<jeton>@<domaine>`. */
const REPLY_PREFIX = 'rfq-'
const REPLY_TOKEN = /^[0-9a-f]{32}$/

/** Adresse relais d'un couple demande / fournisseur. */
export function replyAddress(token: string, domain: string): string {
  return `${REPLY_PREFIX}${token}@${domain}`
}

/**
 * Jeton porté par la première adresse relais trouvée parmi `addresses`, ou
 * `null`. Insensible à la casse : les messageries réécrivent la partie locale.
 */
export function replyTokenFrom(addresses: string[], domain: string): string | null {
  const suffix = `@${domain.toLowerCase()}`
  for (const raw of addresses) {
    const { address } = parseMailAddress(raw)
    if (!address.endsWith(suffix) || !address.startsWith(REPLY_PREFIX)) continue
    const token = address.slice(REPLY_PREFIX.length, -suffix.length)
    if (REPLY_TOKEN.test(token)) return token
  }
  return null
}

/** Décompose `Nom <adresse>` (ou une adresse seule). L'adresse sort en minuscules. */
export function parseMailAddress(raw: string): MailAddressParts {
  const match = raw.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/)
  if (!match) return { address: raw.trim().toLowerCase(), name: null }
  const name = match[1].replace(/^"|"$/g, '').trim()
  return { address: match[2].trim().toLowerCase(), name: name || null }
}

/**
 * En-têtes d'un mail brut (`.eml`) : le bloc qui précède la première ligne vide,
 * lignes repliées recollées, noms en minuscules. Un en-tête répété garde sa
 * première valeur.
 */
export function parseRawHeaders(raw: string): Record<string, string> {
  const end = raw.search(/\r?\n\r?\n/)
  const block = end === -1 ? raw : raw.slice(0, end)
  const headers: Record<string, string> = {}

  for (const line of block.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const separator = line.indexOf(':')
    if (separator <= 0) continue
    const name = line.slice(0, separator).trim().toLowerCase()
    if (!(name in headers)) headers[name] = line.slice(separator + 1).trim()
  }
  return headers
}

/** Expéditeurs techniques : avis de non-remise et robots. */
const AUTOMATED_SENDERS = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounces?)([+@-]|$)/

/**
 * Le mail est-il une réponse automatique (absence, accusé, avis de non-remise) ?
 * Signaux de la RFC 3834 et usages des messageries courantes. `headers` : noms
 * en minuscules.
 */
export function isAutomaticReply(headers: Record<string, string>, senderAddress: string): boolean {
  const autoSubmitted = headers['auto-submitted']?.toLowerCase()
  if (autoSubmitted && !autoSubmitted.startsWith('no')) return true

  if ('x-autoreply' in headers || 'x-autorespond' in headers) return true
  if ('x-auto-response-suppress' in headers) return true
  if (/^(bulk|junk|list|auto_reply)$/i.test(headers['precedence'] ?? '')) return true
  if ((headers['return-path'] ?? '').trim() === '<>') return true
  if (/multipart\/report/i.test(headers['content-type'] ?? '')) return true

  return AUTOMATED_SENDERS.test(senderAddress)
}

/** Extension en minuscules d'un nom de fichier, sans le point (`''` si aucune). */
export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot <= 0 ? '' : filename.slice(dot + 1).toLowerCase()
}

/** Type MIME à stocker pour une pièce jointe acceptée, `null` si elle est refusée. */
export function acceptedAttachmentType(filename: string): string | null {
  return INBOUND_ATTACHMENT_TYPES[fileExtension(filename)] ?? null
}
