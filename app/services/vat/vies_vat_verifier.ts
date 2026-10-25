import logger from '@adonisjs/core/services/logger'
import VatVerifier from '#services/vat/vat_verifier'
import { isViesCountry } from '#shared/helpers/tax_id'
import type { VatCheckStatus } from '#shared/types/agency_signup'

const VIES_ENDPOINT = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number'
const VIES_TIMEOUT_MS = 5000

interface ViesResponse {
  valid?: boolean
  userError?: string
}

/**
 * Interroge l'API REST VIES de la Commission européenne. Aucune erreur n'est
 * propagée : un VIES indisponible (fréquent, il dépend des administrations
 * nationales) donne `unavailable` et l'inscription part en validation manuelle.
 */
export default class ViesVatVerifier extends VatVerifier {
  async check(countryCode: string, vatNumber: string): Promise<VatCheckStatus> {
    if (!isViesCountry(countryCode)) return 'unavailable'

    try {
      const response = await fetch(VIES_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ countryCode, vatNumber }),
        signal: AbortSignal.timeout(VIES_TIMEOUT_MS),
      })
      if (!response.ok) return 'unavailable'

      const body = (await response.json()) as ViesResponse
      if (body.valid === true) return 'valid'
      // `valid: false` accompagne aussi les pannes côté État membre (MS_UNAVAILABLE…).
      if (body.valid === false && (!body.userError || body.userError === 'INVALID')) {
        return 'invalid'
      }
      return 'unavailable'
    } catch (error) {
      logger.warn({ err: error, countryCode }, 'VIES check failed')
      return 'unavailable'
    }
  }
}
