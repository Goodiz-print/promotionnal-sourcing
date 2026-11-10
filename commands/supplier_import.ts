import { inject } from '@adonisjs/core'
import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import SupplierConnectorRegistry from '#services/supplier_feed/supplier_connector_registry'
import SupplierCatalogueImporter from '#services/supplier_feed/supplier_catalogue_importer'
import {
  SupplierConnectorNotConfiguredException,
  SupplierConnectorNotImplementedException,
  SupplierFeedHttpException,
  UnknownSupplierConnectorException,
} from '#exceptions/supplier_feed_errors'
import { SUPPLIER_FEED_LOCALES, type SupplierFeedLocale } from '#shared/types/supplier_feed'
import type SupplierConnector from '#services/supplier_feed/supplier_connector'
import type { SupplierImportSummary } from '#shared/types/supplier_feed'

/** Erreurs attendues d'un connecteur : affichées proprement, sans pile. */
const EXPECTED_ERRORS = [
  SupplierConnectorNotConfiguredException,
  SupplierConnectorNotImplementedException,
  SupplierFeedHttpException,
]

/**
 * Importe le catalogue réel d'un fournisseur (ou de tous) dans la base courante,
 * pour peupler dev / staging : `node ace supplier:import pfconcept --limit=20`.
 *
 * Les identifiants viennent de `.env` (voir `docs/supplier-feeds.md`). Les prix
 * importés sont les prix nets du compte : **jamais en production** sans
 * `--force`. Relançable : les fiches sont mises à jour, sans doublon.
 */
export default class SupplierImport extends BaseCommand {
  static commandName = 'supplier:import'
  static description =
    "Importe le catalogue réel d'un fournisseur (pfconcept, passot, inspirion, axpol, all)"

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Connecteur : pfconcept, passot, inspirion, axpol ou all' })
  declare connector: string

  @flags.number({ description: 'Nombre maximal de produits par fournisseur', default: 200 })
  declare limit: number

  @flags.string({
    description: `Langue du flux (${SUPPLIER_FEED_LOCALES.join(', ')})`,
    default: 'fr',
  })
  declare locale: string

  @flags.boolean({ description: 'Récupère et normalise sans rien écrire en base' })
  declare dryRun: boolean

  @flags.boolean({ description: 'Copie les images dans Cellar (sinon URL fournisseur conservée)' })
  declare storeImages: boolean

  @flags.boolean({ description: 'Ne touche pas aux images' })
  declare skipImages: boolean

  @flags.boolean({ description: 'Autorise l’exécution en production' })
  declare force: boolean

  @inject()
  async run(registry: SupplierConnectorRegistry, importer: SupplierCatalogueImporter) {
    if (this.app.inProduction && !this.force) {
      this.logger.error(
        'Refusé en production (prix nets réels) : relancez avec --force si c’est voulu.'
      )
      this.exitCode = 1
      return
    }
    if (!(SUPPLIER_FEED_LOCALES as readonly string[]).includes(this.locale)) {
      this.logger.error(
        `Langue inconnue « ${this.locale} » (attendues : ${SUPPLIER_FEED_LOCALES.join(', ')})`
      )
      this.exitCode = 1
      return
    }
    if (!Number.isInteger(this.limit) || this.limit < 1) {
      this.logger.error('--limit doit être un entier positif')
      this.exitCode = 1
      return
    }

    let connectors: SupplierConnector[]
    try {
      connectors = this.connector === 'all' ? registry.all() : [registry.get(this.connector)]
    } catch (error) {
      if (!(error instanceof UnknownSupplierConnectorException)) throw error
      this.logger.error(error.message)
      this.exitCode = 1
      return
    }

    for (const connector of connectors) {
      if (this.connector === 'all' && !connector.isConfigured()) {
        this.logger.warning(`${connector.key} : non configuré, ignoré`)
        continue
      }
      this.logger.info(
        `${connector.key} : import${this.dryRun ? ' (dry-run)' : ''}, ${this.limit} produit(s) max…`
      )
      try {
        const summary = await importer.import(connector, {
          limit: this.limit,
          locale: this.locale as SupplierFeedLocale,
          dryRun: this.dryRun,
          storeImages: this.storeImages,
          skipImages: this.skipImages,
        })
        this.report(summary)
        if (summary.failed > 0) this.exitCode = 1
      } catch (error) {
        if (!EXPECTED_ERRORS.some((type) => error instanceof type)) throw error
        this.logger.error(`${connector.key} : ${(error as Error).message}`)
        this.exitCode = 1
      }
    }
  }

  private report(summary: SupplierImportSummary) {
    this.logger.success(
      `${summary.supplier} : ${summary.fetched} récupéré(s), ${summary.created} créé(s), ` +
        `${summary.updated} mis à jour, ${summary.failed} en échec`
    )
    if (summary.unmatchedCategories.length > 0) {
      this.logger.warning(
        `Catégories non reconnues (→ « Non classé ») : ${summary.unmatchedCategories.slice(0, 15).join(' | ')}` +
          (summary.unmatchedCategories.length > 15
            ? ` … (+${summary.unmatchedCategories.length - 15})`
            : '')
      )
    }
    if (summary.unmatchedTechniques.length > 0) {
      this.logger.warning(
        `Techniques de marquage ignorées : ${summary.unmatchedTechniques.join(' | ')}`
      )
    }
    for (const error of summary.errors.slice(0, 10)) {
      this.logger.error(`  ${error.externalId} : ${error.message}`)
    }
  }
}
