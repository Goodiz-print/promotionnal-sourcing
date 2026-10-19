import { randomUUID } from 'node:crypto'
import type { MailKind } from '#shared/types/mail'

/**
 * Clé d'idempotence d'un mail : `<kind>:<clé>=<valeur>:…` (ex.
 * `rfq-received:rfq=12:org=7:to=a@b.fr`). Les parts sont triées par nom pour que
 * la clé ne dépende pas de l'ordre de déclaration.
 *
 * - Mail **rattaché à un fait métier unique** (une RFQ envoyée à un destinataire) :
 *   passer les identifiants métier — un rejeu produit la même clé.
 * - Mail dont l'**envoi peut légitimement se répéter** (renvoi d'invitation,
 *   nouveau lien de réinitialisation) : ajouter `send: randomUUID()` via
 *   `mailSendKey` — la clé dédoublonne les rejeux d'*un* envoi, pas deux envois voulus.
 */
export function mailIdempotencyKey(kind: MailKind, parts: Record<string, string | number>): string {
  const suffix = Object.entries(parts)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => `${name}=${String(value).toLowerCase()}`)
  return [kind, ...suffix].join(':')
}

/** Clé d'un envoi unique à la demande (un nouvel appel = un nouvel envoi). */
export function mailSendKey(kind: MailKind, parts: Record<string, string | number>): string {
  return mailIdempotencyKey(kind, { ...parts, send: randomUUID() })
}
