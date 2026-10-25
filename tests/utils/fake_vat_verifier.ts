import app from '@adonisjs/core/services/app'
import VatVerifier from '#services/vat/vat_verifier'
import type { VatCheckStatus } from '#shared/types/agency_signup'

/**
 * Faux VIES : réponse imposée, appels enregistrés, aucun accès réseau.
 */
export class FakeVatVerifier extends VatVerifier {
  readonly calls: Array<{ countryCode: string; vatNumber: string }> = []

  constructor(public status: VatCheckStatus = 'valid') {
    super()
  }

  async check(countryCode: string, vatNumber: string): Promise<VatCheckStatus> {
    this.calls.push({ countryCode, vatNumber })
    return this.status
  }
}

/** Remplace `VatVerifier` dans le conteneur ; à restaurer avec la fonction renvoyée. */
export function installFakeVat(status: VatCheckStatus = 'valid') {
  const fake = new FakeVatVerifier(status)
  app.container.swap(VatVerifier, () => fake)
  return { fake, restore: () => app.container.restore(VatVerifier) }
}
