import type { ApplicationService } from '@adonisjs/core/types'
import GhostscriptRunner from '#services/pdf/ghostscript_runner'
import ProcessGhostscriptRunner from '#services/pdf/process_ghostscript_runner'

/**
 * Lie le compresseur PDF abstrait à Ghostscript (processus `gs`).
 */
export default class PdfProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(GhostscriptRunner, (resolver) => {
      return resolver.make(ProcessGhostscriptRunner)
    })
  }
}
