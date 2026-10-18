import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import GhostscriptRunner from '#services/pdf/ghostscript_runner'

export interface CompressedPdf {
  content: Buffer
  /** Faux si la compression a été ignorée (repli) : le contenu est alors l'original. */
  compressed: boolean
}

/**
 * Compression des PDF avant stockage (#60). Ne lève jamais : si Ghostscript est
 * absent, échoue, ou n'allège pas le fichier, le PDF original est gardé et un
 * warning est loggé.
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
}
