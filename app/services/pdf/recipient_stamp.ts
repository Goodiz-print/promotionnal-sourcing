import {
  PDFAcroSignature,
  PDFName,
  rgb,
  type PDFDocument,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import {
  PDF_MAX_PAGE_SIZE,
  RECIPIENT_BANNER_HEIGHT,
  type RecipientStampOptions,
  type RecipientStampRefusal,
} from '#shared/types/pdf'

/**
 * Mise en page de la mention « devis établi pour » (#238), sans effet de bord
 * hors du document `pdf-lib` reçu. Le bandeau **agrandit** la première page
 * vers le haut : le contenu d'origine n'est ni déplacé ni masqué.
 */

const FONT_SIZE = 10
const MIN_FONT_SIZE = 6
const MARGIN = 12
const ELLIPSIS = '…'
/** Page de garde au format A4 quand le bandeau ne peut pas être posé. */
const COVER_PAGE_SIZE: [number, number] = [595.28, 841.89]
const BANNER_COLOR = rgb(0.94, 0.94, 0.94)
const TEXT_COLOR = rgb(0.1, 0.1, 0.1)

/** Texte de la mention, avant adaptation à la police. */
export function recipientLabel({ agencyName, rfqRef }: RecipientStampOptions): string {
  return `Devis établi pour : ${agencyName.trim()} — demande n° ${rfqRef}`
}

/**
 * Raison de transmettre le PDF tel quel, ou `null` s'il peut porter la mention :
 *
 *  - `signed` : il porte une signature, que la modification invaliderait ;
 *  - `unencodable` : la police standard ne sait pas écrire toute la mention
 *    (nom d'agence en cyrillique, en grec, en idéogrammes…). Un bandeau
 *    amputé du nom laisserait croire l'agence nommée : le nom passe alors par
 *    le mail de transmission (#225).
 */
export function refusalOf(
  document: PDFDocument,
  label: string,
  font: PDFFont
): RecipientStampRefusal | null {
  if (isSigned(document)) return 'signed'
  if (!canEncode(label, font)) return 'unencodable'
  return null
}

/**
 * Un champ de signature **rempli** (`/V`) : un emplacement vide, prévu pour
 * une signature à venir, n'empêche pas l'apposition.
 */
function isSigned(document: PDFDocument): boolean {
  const fields = document.catalog.getAcroForm()?.getAllFields() ?? []
  return fields.some(
    ([field]) => field instanceof PDFAcroSignature && field.dict.has(PDFName.of('V'))
  )
}

/**
 * Le bandeau tient en tête de la page sans la pivoter ni dépasser la taille
 * maximale d'une page ; sinon, repli sur une page de garde.
 */
export function canHoldBanner(page: PDFPage): boolean {
  const isUpright = page.getRotation().angle % 360 === 0
  const fits = page.getMediaBox().height + RECIPIENT_BANNER_HEIGHT <= PDF_MAX_PAGE_SIZE
  return isUpright && fits
}

/** La police standard (WinAnsi) sait-elle écrire tout le texte ? */
function canEncode(text: string, font: PDFFont): boolean {
  try {
    font.encodeText(text)
    return true
  } catch {
    return false
  }
}

/** Taille de police qui fait tenir le texte, puis troncature en dernier recours. */
export function fitText(text: string, font: PDFFont, maxWidth: number) {
  const size = Math.max(MIN_FONT_SIZE, Math.min(FONT_SIZE, fontSizeFor(text, font, maxWidth)))
  const characters = [...text]
  const fitsAt = (length: number) =>
    font.widthOfTextAtSize(characters.slice(0, length).join('') + ELLIPSIS, size) <= maxWidth

  if (font.widthOfTextAtSize(text, size) <= maxWidth) return { text, size }
  const length = characters.findLastIndex((_, index) => fitsAt(index))
  return { text: characters.slice(0, Math.max(length, 0)).join('') + ELLIPSIS, size }
}

function fontSizeFor(text: string, font: PDFFont, maxWidth: number): number {
  return (FONT_SIZE * maxWidth) / Math.max(font.widthOfTextAtSize(text, FONT_SIZE), 1)
}

/**
 * Agrandit la page vers le haut de la hauteur du bandeau et l'y dessine. La
 * zone visible (`CropBox`) est agrandie d'autant.
 */
export function addBanner(page: PDFPage, label: string, font: PDFFont): void {
  const crop = page.getCropBox()
  const media = page.getMediaBox()
  const bannerBottom = crop.y + crop.height
  const top = Math.max(media.y + media.height, bannerBottom + RECIPIENT_BANNER_HEIGHT)

  page.setMediaBox(media.x, media.y, media.width, top - media.y)
  page.setCropBox(crop.x, crop.y, crop.width, crop.height + RECIPIENT_BANNER_HEIGHT)
  page.drawRectangle({
    x: crop.x,
    y: bannerBottom,
    width: crop.width,
    height: RECIPIENT_BANNER_HEIGHT,
    color: BANNER_COLOR,
  })
  const fitted = fitText(label, font, crop.width - 2 * MARGIN)
  page.drawText(fitted.text, {
    x: crop.x + MARGIN,
    y: bannerBottom + (RECIPIENT_BANNER_HEIGHT - fitted.size) / 2 + 1,
    size: fitted.size,
    font,
    color: TEXT_COLOR,
  })
}

/** Insère une page de garde portant la mention avant le devis. */
export function addCoverPage(document: PDFDocument, label: string, font: PDFFont): void {
  const page = document.insertPage(0, COVER_PAGE_SIZE)
  const [width, height] = COVER_PAGE_SIZE
  const fitted = fitText(label, font, width - 4 * MARGIN)
  page.drawText(fitted.text, {
    x: 2 * MARGIN,
    y: height - 6 * MARGIN,
    size: fitted.size,
    font,
    color: TEXT_COLOR,
  })
}
