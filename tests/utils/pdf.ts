import app from '@adonisjs/core/services/app'
import type { Group } from '@japa/runner/core'
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
