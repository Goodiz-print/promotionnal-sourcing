import { AdClickSchema } from '#database/schema'
import type { AdPlacement, AdUnbilledReason } from '#shared/types/ads'

/** Clic sur un produit sponsorisé, facturé ou non. En ajout seul. */
export default class AdClick extends AdClickSchema {
  static table = 'ad_clicks'

  declare placement: AdPlacement
  declare unbilledReason: AdUnbilledReason | null
}
