import app from '@adonisjs/core/services/app'
import type { Group } from '@japa/runner/core'
import { degrees, PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib'
import GhostscriptRunner from '#services/pdf/ghostscript_runner'

/** Compresseur factice : divise la taille, ou ne fait rien si `available` est faux. */
export class HalvingRunner extends GhostscriptRunner {
  constructor(private isAvailable = true) {
    super()
  }

  async available() {
    return this.isAvailable
  }

  async compress(content: Buffer) {
    return content.subarray(0, Math.ceil(content.length / 2))
  }
}

/** Contenu commençant par l'en-tête PDF, de la taille demandée. */
export const pdfBuffer = (size: number) =>
  Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(size - 9, 'p')])

/**
 * Remplace Ghostscript par le compresseur factice le temps de chaque test du
 * groupe. `available: false` : aucune compression, le PDF reste tel quel.
 */
export function useFakeGhostscript(group: Group, options: { available?: boolean } = {}): void {
  group.each.setup(() => {
    app.container.swap(GhostscriptRunner, () => new HalvingRunner(options.available ?? true))
    return () => app.container.restore(GhostscriptRunner)
  })
}

/** Options d'un vrai PDF de test (`realPdf`). */
interface RealPdfOptions {
  pages?: number
  /** Rotation de la première page, en degrés. */
  rotation?: number
  /** Hauteur des pages, en points (A4 par défaut). */
  height?: number
}

/** Vrai PDF lisible par `pdf-lib`, une ligne de texte par page. */
export async function realPdf(options: RealPdfOptions = {}): Promise<Buffer> {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  Array.from({ length: options.pages ?? 1 }, (_, index) => {
    const page = document.addPage([595.28, options.height ?? 841.89])
    page.drawText(`Devis fournisseur, page ${index + 1}`, { x: 50, y: 50, size: 12, font })
    return page
  })
  if (options.rotation) document.getPage(0).setRotation(degrees(options.rotation))
  return Buffer.from(await document.save())
}

/** PDF dont la remorque déclare un chiffrement : `pdf-lib` refuse de le modifier. */
export async function encryptedPdf(): Promise<Buffer> {
  const document = await PDFDocument.load(await realPdf())
  document.context.trailerInfo.Encrypt = document.context.obj({ Filter: 'Standard', V: 2 })
  return Buffer.from(await document.save())
}

/**
 * PDF portant un champ de signature électronique : rempli (`/V`, signé) par
 * défaut, vide (emplacement à signer) avec `filled: false`.
 */
export async function signedPdf({ filled = true } = {}): Promise<Buffer> {
  const document = await PDFDocument.load(await realPdf())
  const { context } = document
  const value = context.obj({ Type: 'Sig', Filter: 'Adobe.PPKLite' })
  const field = context.register(
    context.obj({ FT: 'Sig', T: PDFString.of('Signature1'), ...(filled && { V: value }) })
  )
  document.catalog.set(PDFName.of('AcroForm'), context.obj({ Fields: [field], SigFlags: 3 }))
  return Buffer.from(await document.save())
}
