import supplierFeedsConfig from '#config/supplier_feeds'
import SupplierConnector from '#services/supplier_feed/supplier_connector'
import {
  SupplierConnectorNotConfiguredException,
  SupplierConnectorNotImplementedException,
} from '#exceptions/supplier_feed_errors'
import type { NormalizedProduct } from '#shared/types/supplier_feed'

/**
 * Inspirion : squelette uniquement. Le mapping sera écrit à réception de
 * la documentation de la LEO API (voir `docs/supplier-feeds.md`).
 */
export default class InspirionConnector extends SupplierConnector {
  readonly key = 'inspirion' as const

  readonly identity = {
    slug: 'inspirion',
    name: 'Inspirion',
    country: 'DE',
    website: 'https://www.inspirion.eu',
  }

  isConfigured(): boolean {
    return Boolean(supplierFeedsConfig.inspirion.apiKey)
  }

  async fetchCatalogue(): Promise<NormalizedProduct[]> {
    if (!this.isConfigured()) {
      throw new SupplierConnectorNotConfiguredException('INSPIRION_API_KEY manquant dans .env')
    }
    throw new SupplierConnectorNotImplementedException(
      'Connecteur Inspirion non implémenté : documentation fournisseur en attente'
    )
  }
}
