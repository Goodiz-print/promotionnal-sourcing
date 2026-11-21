import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import GhostscriptRunner from '#services/pdf/ghostscript_runner'
import {
  addBanner,
  addCoverPage,
  canHoldBanner,
  encodable,
  isSigned,
  recipientLabel,
} from '#services/pdf/recipient_stamp'
import type { RecipientStampOptions } from '#shared/types/pdf'

export interface CompressedPdf {
  content: Buffer
  /** Faux si la compression a été ignorée (repli) : le contenu est alors l'original. */
  compressed: boolean
}

/**
 * Traitements des PDF avant stockage. Aucun ne lève : en cas d'échec, le PDF
 * original est gardé et un warning est loggé.
 *
 *  - `compress` (#60) : Ghostscript ; repli si absent, en échec, ou sans gain ;
 *  - `stampRecipient` (#238) : mention de l'agence destinataire sur un devis.
 */
@inject()
export default class PdfService {
  constructor(private runner: GhostscriptRunner) {}

  async compress(content: Buffer): Promise<CompressedPdf> {
    if (!(await this.runner.available())) {
      logger.warn('ghostscript unavailable, storing PDF without compression')
      return { content, compressed: false }
    }

    try {
      const compressed = await this.runner.compress(content)
      if (compressed.length === 0 || compressed.length >= content.length) {
        return { content, compressed: false }
      }
      return { content: compressed, compressed: true }
    } catch (error) {
      logger.warn({ err: error }, 'pdf compression failed, storing original')
      return { content, compressed: false }
    }
  }

  /**
   * Version destinataire d'un devis (#238) : « Devis établi pour : <agence> —
   * demande n° … » dans un bandeau ajouté en tête de la première page (la page
   * est agrandie, rien n'est masqué), à défaut sur une page de garde.
   *
   * Un PDF chiffré, signé ou illisible est renvoyé **tel quel** — la même
   * instance de `Buffer`, que l'appelant peut comparer à l'entrée.
   */
  async stampRecipient(content: Buffer, options: RecipientStampOptions): Promise<Buffer> {
    try {
      const document = await PDFDocument.load(content, { updateMetadata: false })
      if (isSigned(document)) {
        logger.warn('signed PDF left as is, the recipient stamp would void its signature')
        return content
      }
      await this.stamp(document, options)
      return Buffer.from(await document.save())
    } catch (error) {
      logger.warn({ err: error }, 'pdf recipient stamp failed, keeping original')
      return content
    }
  }

  private async stamp(document: PDFDocument, options: RecipientStampOptions): Promise<void> {
    const font = await document.embedFont(StandardFonts.Helvetica)
    const label = encodable(recipientLabel(options), font)
    const [first] = document.getPages()
    if (first && canHoldBanner(first)) return addBanner(first, label, font)
    addCoverPage(document, label, font)
  }
}
