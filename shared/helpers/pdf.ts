/** En-tête par lequel commence tout fichier PDF. */
const PDF_HEADER = '%PDF-'

/**
 * Le contenu est-il un PDF ? L'extension ou le type déclaré ne prouvent rien :
 * un PDF commence par son en-tête `%PDF-`.
 */
export function hasPdfHeader(content: Uint8Array): boolean {
  const head = content.subarray(0, PDF_HEADER.length)
  return String.fromCharCode(...head) === PDF_HEADER
}
