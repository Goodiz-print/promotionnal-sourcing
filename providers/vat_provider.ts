import type { ApplicationService } from '@adonisjs/core/types'
import VatVerifier from '#services/vat/vat_verifier'
import ViesVatVerifier from '#services/vat/vies_vat_verifier'

/**
 * Lie le contrôle de TVA abstrait à VIES.
 */
export default class VatProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(VatVerifier, (resolver) => {
      return resolver.make(ViesVatVerifier)
    })
  }
}
