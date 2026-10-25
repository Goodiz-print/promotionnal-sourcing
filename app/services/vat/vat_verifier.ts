import type { VatCheckStatus } from '#shared/types/agency_signup'

/**
 * Contrôle d'un numéro de TVA intracommunautaire. Classe abstraite : jeton
 * d'injection lié à l'implémentation VIES dans `providers/vat_provider.ts`,
 * remplacé par un faux en test.
 */
export default abstract class VatVerifier {
  abstract check(countryCode: string, vatNumber: string): Promise<VatCheckStatus>
}
