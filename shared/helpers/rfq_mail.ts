import type {
  RfqMailItemSource,
  RfqMailLine,
  RfqMailMarking,
  RfqMailPrices,
} from '../types/mail.js'

/**
 * Ligne de mail d'un `rfq_item` (#219). Les options et prix indicatifs sont lus
 * dans `specs`, aux clés posées par le panier (`QUOTE_CART_SPEC_KEYS`) : une
 * demande saisie à la main, sans `specs`, donne une ligne sans marquage ni prix.
 */
export function rfqMailLine(item: RfqMailItemSource): RfqMailLine {
  const specs = item.specs ?? {}
  return {
    name: item.name,
    reference: specs.sku ?? item.productReference,
    variant: specs.variant ?? null,
    quantity: item.quantity,
    unit: item.unit,
    marking: markingOf(specs),
    note: item.description?.trim() || null,
    prices: pricesOf(specs),
  }
}

function markingOf(specs: Record<string, string>): RfqMailMarking | null {
  const marking = {
    position: specs.markingPosition ?? null,
    technique: specs.markingTechnique ?? null,
    colors: specs.markingColors ?? null,
  }
  return hasAnyValue(marking) ? marking : null
}

function pricesOf(specs: Record<string, string>): RfqMailPrices | null {
  const prices = {
    unitPrice: specs.estimatedUnitPrice ?? null,
    markingUnitPrice: specs.estimatedMarkingUnitPrice ?? null,
    setupCharge: specs.estimatedSetupCharge ?? null,
    total: specs.estimatedTotal ?? null,
  }
  return hasAnyValue(prices) ? prices : null
}

function hasAnyValue(record: Record<string, string | null>): boolean {
  return Object.values(record).some((value) => value !== null)
}
