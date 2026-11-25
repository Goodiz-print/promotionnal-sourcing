import { inject } from '@adonisjs/core'
import type SupplierConnector from '#services/supplier_feed/supplier_connector'
import PfConceptConnector from '#services/supplier_feed/pfconcept_connector'
import PassotConnector from '#services/supplier_feed/passot_connector'
import InspirionConnector from '#services/supplier_feed/inspirion_connector'
import MakitoConnector from '#services/supplier_feed/makito_connector'
import { UnknownSupplierConnectorException } from '#exceptions/supplier_feed_errors'
import { SUPPLIER_FEED_KEYS, type SupplierFeedKey } from '#shared/types/supplier_feed'

/** Résout un connecteur fournisseur par sa clé (`pfconcept`, `passot`…). */
@inject()
export default class SupplierConnectorRegistry {
  private connectors: Map<SupplierFeedKey, SupplierConnector>

  constructor(
    pfconcept: PfConceptConnector,
    passot: PassotConnector,
    inspirion: InspirionConnector,
    makito: MakitoConnector
  ) {
    this.connectors = new Map<SupplierFeedKey, SupplierConnector>(
      [pfconcept, passot, inspirion, makito].map((connector) => [connector.key, connector])
    )
  }

  isKey(value: string): value is SupplierFeedKey {
    return (SUPPLIER_FEED_KEYS as readonly string[]).includes(value)
  }

  get(key: string): SupplierConnector {
    const connector = this.isKey(key) ? this.connectors.get(key) : undefined
    if (!connector) {
      throw new UnknownSupplierConnectorException(
        `Connecteur inconnu « ${key} » (attendus : ${SUPPLIER_FEED_KEYS.join(', ')})`
      )
    }
    return connector
  }

  all(): SupplierConnector[] {
    return [...this.connectors.values()]
  }
}
