import supplierFeedsConfig from '#config/supplier_feeds'
import SupplierConnector from '#services/supplier_feed/supplier_connector'
import {
  SupplierConnectorNotConfiguredException,
  SupplierConnectorNotImplementedException,
} from '#exceptions/supplier_feed_errors'
import type { NormalizedProduct } from '#shared/types/supplier_feed'

/**
 * Axpol : squelette uniquement. Le mapping sera écrit à réception de
 * le mot de passe et l'archive de la documentation (voir `docs/supplier-feeds.md`).
 */
export default class AxpolConnector extends SupplierConnector {
  readonly key = 'axpol' as const

  readonly identity = {
    slug: 'axpol',
    name: 'Axpol',
    country: 'PL',
    website: 'https://axpol.com.pl',
  }

  isConfigured(): boolean {
    return Boolean(supplierFeedsConfig.axpol.apiKey)
  }

  async fetchCatalogue(): Promise<NormalizedProduct[]> {
    if (!this.isConfigured()) {
      throw new SupplierConnectorNotConfiguredException('AXPOL_API_KEY manquant dans .env')
    }
    throw new SupplierConnectorNotImplementedException(
      'Connecteur Axpol non implémenté : documentation fournisseur en attente'
    )
  }
}
