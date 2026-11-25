import RfqTransformer from '#transformers/rfq_transformer'
import { rfqProgress } from '#shared/helpers/rfq_list'
import type { RfqListItemType } from '#shared/types/rfq'

/**
 * Ligne de « Mes demandes » (#228) : la ligne de liste, plus l'auteur,
 * l'avancement lisible et l'indicateur « devis reçu ». Suppose préchargés
 * `items`, `suppliers` et `createdBy`, et comptés les devis remis et les devis
 * PDF (`$extras.receivedQuotesCount`, `$extras.quoteDocumentsCount`,
 * `RfqService#listForBuyer`).
 */
export default class RfqListItemTransformer extends RfqTransformer {
  toObject(): RfqListItemType {
    const row = super.toObject()
    return {
      ...row,
      createdByName: this.resource.createdBy?.fullName ?? null,
      progress: rfqProgress({
        ...row,
        sentCount: this.resource.suppliers.filter(({ status }) => status !== 'pending').length,
      }),
      hasReceivedQuote: [
        this.resource.$extras.receivedQuotesCount,
        this.resource.$extras.quoteDocumentsCount,
      ].some((count) => Number(count ?? 0) > 0),
    }
  }
}
