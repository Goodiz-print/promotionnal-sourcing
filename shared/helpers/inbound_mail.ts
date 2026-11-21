import {
  CONVERSATION_SIDES,
  MESSAGE_MAX_LENGTH,
  type ConversationSide,
} from '../types/conversation.js'
import {
  INBOUND_ATTACHMENT_TYPES,
  type MailAddressParts,
  type RelayTarget,
  type RelayTokenField,
} from '../types/inbound_mail.js'

/** Préfixe de la partie locale d'une adresse relais, selon le côté qui l'utilise. */
const RELAY_PREFIXES: Record<ConversationSide, string> = {
  supplier: 'rfq-',
  agency: 'agency-',
}
const REPLY_TOKEN = /^[0-9a-f]{32}$/

/** Colonne de `rfq_suppliers` qui porte le jeton de l'adresse relais de chaque côté. */
export const RELAY_TOKEN_FIELDS: Record<ConversationSide, RelayTokenField> = {
  supplier: 'replyToken',
  agency: 'agencyReplyToken',
}

/**
 * Adresse relais **côté fournisseur** d'un couple demande / fournisseur :
 * `rfq-<jeton>@<domaine>`, posée en `Reply-To` des mails envoyés au fournisseur.
 */
export function replyAddress(token: string, domain: string): string {
  return `${RELAY_PREFIXES.supplier}${token}@${domain}`
}

/**
 * Adresse relais **côté agence** du même couple (#225) : `agency-<jeton>@<domaine>`,
 * avec le jeton propre à l'agence (`rfq_suppliers.agency_reply_token`), jamais
 * celui du fournisseur. Posée en `Reply-To` des mails envoyés à l'agence.
 */
export function agencyReplyAddress(token: string, domain: string): string {
  return `${RELAY_PREFIXES.agency}${token}@${domain}`
}

/** Côté et jeton d'une adresse relais, ou `null` si ce n'en est pas une. */
function relayTargetOf(raw: string, suffix: string): RelayTarget | null {
  const { address } = parseMailAddress(raw)
  if (!address.endsWith(suffix)) return null
  const local = address.slice(0, -suffix.length)
  const side = CONVERSATION_SIDES.find((candidate) => local.startsWith(RELAY_PREFIXES[candidate]))
  if (!side) return null
  const token = local.slice(RELAY_PREFIXES[side].length)
  return REPLY_TOKEN.test(token) ? { side, token } : null
}

/**
 * Première adresse relais trouvée parmi `addresses` (#226) : le côté qui écrit
 * (`rfq-` → le fournisseur, `agency-` → l'agence) et son jeton, ou `null`.
 * Insensible à la casse : les messageries réécrivent la partie locale.
 */
export function relayTargetFrom(addresses: string[], domain: string): RelayTarget | null {
  const suffix = `@${domain.toLowerCase()}`
  return addresses.reduce<RelayTarget | null>(
    (found, raw) => found ?? relayTargetOf(raw, suffix),
    null
  )
}

/**
 * En-têtes d'un mail reçu que le mail relayé peut reprendre (#226) : seulement
 * des consignes de priorité, qui ne disent rien de l'expéditeur. Tout le reste
 * est écarté — `From`, `Reply-To`, `Sender`, `Return-Path`, `Received`,
 * `X-Originating-IP`, `Message-ID`, `References`, signatures DKIM, `X-Mailer`… —
 * car ces en-têtes trahiraient l'agence (nom, domaine, adresse IP, logiciel).
 * Liste blanche : un en-tête inconnu n'est jamais repris. Noms en minuscules.
 */
const RELAYABLE_HEADERS: Record<string, string> = {
  'importance': 'Importance',
  'priority': 'Priority',
  'x-priority': 'X-Priority',
}
/** Longueur au-delà de laquelle une valeur n'est pas une simple consigne. */
const RELAYABLE_HEADER_MAX = 32
/** Valeur d'une consigne (`high`, `1 (Highest)`) : ni adresse, ni saut de ligne. */
const RELAYABLE_HEADER_VALUE = /^[\w ,.()-]+$/

/** La valeur est-elle une simple consigne, sans rien qui désigne l'expéditeur ? */
function isRelayableValue(value: string): boolean {
  return value.length <= RELAYABLE_HEADER_MAX && RELAYABLE_HEADER_VALUE.test(value)
}

/**
 * En-têtes du mail d'origine que le mail relayé reprend (liste blanche
 * ci-dessus), sous leur nom canonique. Fonction pure : `headers` a ses noms en
 * minuscules ou non, le résultat ne contient jamais un en-tête hors liste.
 */
export function relayableHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers)
      .map(([name, value]) => [RELAYABLE_HEADERS[name.toLowerCase()], value.trim()] as const)
      .filter(
        (entry): entry is readonly [string, string] =>
          Boolean(entry[0]) && isRelayableValue(entry[1])
      )
  )
}

/**
 * Corps d'un message né d'un mail : la partie texte, à défaut le HTML réduit à
 * du texte, borné comme tout message ; le mail complet reste dans `inbound_mails`.
 */
export function inboundMailBody(text: string | null, html: string | null): string {
  const body = text?.trim() || (html ? htmlToText(html) : '')
  return body.slice(0, MESSAGE_MAX_LENGTH)
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
  // `All` est ce qu'Exchange pose sur ses propres messages automatiques. Les
  // autres valeurs (`OOF, AutoReply`…) viennent d'applications — CRM, ERP — qui
  // les posent sur des mails écrits par une personne : ce n'est pas un signal.
  if (/^\s*all\s*$/i.test(headers['x-auto-response-suppress'] ?? '')) return true
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

/** Premiers octets attendus selon l'extension (« nombre magique » du format). */
const ZIP = [0x50, 0x4b, 0x03, 0x04]
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const FILE_SIGNATURES: Record<string, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpg: [0xff, 0xd8, 0xff],
  jpeg: [0xff, 0xd8, 0xff],
  webp: [0x52, 0x49, 0x46, 0x46],
  doc: OLE,
  xls: OLE,
  docx: ZIP,
  xlsx: ZIP,
  ods: ZIP,
  odt: ZIP,
}
const WEBP_MARK = [0x57, 0x45, 0x42, 0x50]
/** Octets inspectés d'un fichier texte, à la recherche d'un octet nul. */
const TEXT_PROBE_BYTES = 8192

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

/**
 * Le contenu correspond-il au format que son extension annonce ? Écarte un
 * fichier déguisé (un exécutable renommé `devis.pdf`). Un CSV n'a pas de
 * signature : il suffit qu'il ne contienne pas d'octet nul, signe d'un binaire.
 * Une extension sans signature connue est refusée.
 */
export function matchesFileSignature(extension: string, bytes: Uint8Array): boolean {
  if (extension === 'csv') return !bytes.subarray(0, TEXT_PROBE_BYTES).includes(0)

  const signature = FILE_SIGNATURES[extension]
  if (!signature || !startsWith(bytes, signature)) return false
  // `RIFF` ouvre aussi un WAV ou un AVI : le format est nommé à l'octet 8.
  return extension !== 'webp' || startsWith(bytes, WEBP_MARK, 8)
}

/** Type MIME à stocker pour une pièce jointe acceptée, `null` si elle est refusée. */
export function acceptedAttachmentType(filename: string): string | null {
  return INBOUND_ATTACHMENT_TYPES[fileExtension(filename)] ?? null
}

const HTML_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  euro: '€',
}

/** Éléments dont le contenu n'est pas du texte à lire. */
const SKIPPED_ELEMENTS = new Set(['style', 'script', 'head'])
/** Fermetures qui valent un retour à la ligne. */
const BLOCK_ELEMENTS = new Set([
  'p',
  'div',
  'tr',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
])
const TAG_NAME = /^\/?([a-z][a-z0-9]*)/i

/**
 * Part du HTML lue par `htmlToText` : un message ne garde que quelques
 * milliers de caractères, inutile de convertir un mail de plusieurs Mo.
 */
export const HTML_TEXT_SOURCE_MAX = 200_000

/** Caractère d'une entité numérique, ou `null` si le code n'en désigne aucun. */
function characterFor(code: number): string | null {
  const valid = code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
  return valid ? String.fromCodePoint(code) : null
}

/**
 * Retire les balises en un seul passage : chaque recherche repart de là où la
 * précédente s'est arrêtée, le temps reste proportionnel à la taille du HTML
 * même s'il est malformé (balise jamais fermée, `<style>` sans fin).
 */
function stripTags(html: string): string {
  const lower = html.toLowerCase()
  const parts: string[] = []
  let position = 0

  while (position < html.length) {
    const open = html.indexOf('<', position)
    if (open === -1) {
      parts.push(html.slice(position))
      break
    }
    parts.push(html.slice(position, open))

    const close = html.indexOf('>', open)
    // Balise jamais fermée : le reste n'est pas du texte.
    if (close === -1) break

    const tag = html.slice(open + 1, close)
    const name = tag.match(TAG_NAME)?.[1].toLowerCase()
    position = close + 1
    if (!name) continue

    const closing = tag.startsWith('/')
    if (!closing && SKIPPED_ELEMENTS.has(name)) {
      const end = lower.indexOf(`</${name}`, position)
      if (end === -1) break
      const endClose = html.indexOf('>', end)
      if (endClose === -1) break
      position = endClose + 1
    } else if (name === 'br' || (closing && BLOCK_ELEMENTS.has(name))) {
      parts.push('\n')
    }
  }
  return parts.join('')
}

/**
 * Texte lisible d'un corps HTML, pour un mail sans partie texte : balises
 * retirées, blocs et retours à la ligne conservés. Le résultat est du texte
 * brut, jamais réinjecté comme HTML.
 *
 * Le HTML vient d'un tiers : la fonction ne lève jamais (une entité invalide
 * est laissée telle quelle) et son temps est linéaire, sur au plus
 * `HTML_TEXT_SOURCE_MAX` caractères.
 */
export function htmlToText(html: string): string {
  return stripTags(html.slice(0, HTML_TEXT_SOURCE_MAX))
    .replace(/&#(\d{1,7});/g, (entity, code: string) => characterFor(Number(code)) ?? entity)
    .replace(
      /&#x([0-9a-f]{1,6});/gi,
      (entity, code: string) => characterFor(Number.parseInt(code, 16)) ?? entity
    )
    .replace(
      /&([a-z]{1,10});/gi,
      (entity, name: string) => HTML_ENTITIES[name.toLowerCase()] ?? entity
    )
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
