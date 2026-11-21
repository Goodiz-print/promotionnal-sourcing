/**
 * En-tête `Content-Disposition` d'un fichier à télécharger (RFC 6266). Le nom
 * vient d'un tiers (pièce jointe d'un mail) : guillemets, barres obliques et
 * caractères de contrôle sont retirés, et le nom exact passe en `filename*`
 * (UTF-8) à côté d'un repli ASCII pour les clients anciens.
 */
export function attachmentDisposition(filename: string): string {
  const cleaned = [...filename].filter(isSafeFilenameChar).join('').trim() || 'document'
  const ascii = cleaned.normalize('NFKD').replace(/[^\x20-\x7e]/g, '') || 'document'
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeRFC5987(cleaned)}`
}

/** Ni caractère de contrôle (retour à la ligne : injection d'en-tête), ni `"`, `\\`, `/`. */
function isSafeFilenameChar(char: string): boolean {
  const code = char.charCodeAt(0)
  return code > 0x1f && code !== 0x7f && !['"', '\\', '/'].includes(char)
}

/** Encodage d'une valeur `filename*` : `encodeURIComponent`, plus `'()*`. */
function encodeRFC5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )
}
