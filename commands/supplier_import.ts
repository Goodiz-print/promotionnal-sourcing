import { inject } from '@adonisjs/core'
import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import SupplierConnectorRegistry from '#services/supplier_feed/supplier_connector_registry'
import SupplierCatalogueImporter from '#services/supplier_feed/supplier_catalogue_importer'
import {
  SupplierConnectorNotConfiguredException,
  SupplierFeedHttpException,
  SupplierFeedIncompleteException,
  UnknownSupplierConnectorException,
} from '#exceptions/supplier_feed_errors'
import { SUPPLIER_FEED_LOCALES, type SupplierFeedLocale } from '#shared/types/supplier_feed'
import type SupplierConnector from '#services/supplier_feed/supplier_connector'
import type { SupplierImportSummary } from '#shared/types/supplier_feed'

/** Erreurs attendues d'un connecteur : affichées proprement, sans pile. */
const EXPECTED_ERRORS = [
  SupplierConnectorNotConfiguredException,
  SupplierFeedHttpException,
  SupplierFeedIncompleteException,
]

/**
 * Importe le catalogue réel d'un fournisseur (ou de tous) dans la base courante,
 * pour peupler dev / staging : `node ace supplier:import pfconcept --limit=20`,
 * ou tout d'un coup : `node ace supplier:import all --full` (`pnpm db:populate`).
 *
 * Les identifiants viennent de `.env` (voir `docs/supplier-feeds.md`). Les prix
 * importés sont les prix nets du compte : **jamais en production** sans
 * `--force`. Relançable : les fiches sont mises à jour, sans doublon.
 */
export default class SupplierImport extends BaseCommand {
  static commandName = 'supplier:import'
  static description =
    "Importe le catalogue réel d'un fournisseur (pfconcept, passot, inspirion, makito, all)"

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Connecteur : pfconcept, passot, inspirion, makito ou all' })
  declare connector: string

  @flags.number({ description: 'Nombre maximal de produits par fournisseur', default: 200 })
  declare limit: number

  @flags.boolean({
    description: 'Catalogue entier (ignore --limit) ; désactive les fiches absentes du flux',
  })
  declare full: boolean

  @flags.boolean({ description: 'Retélécharge les flux au lieu de réutiliser le cache disque' })
  declare refresh: boolean

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

  @flags.boolean({
    description: 'Désactive les fiches absentes du flux même si elles sont très nombreuses',
  })
  declare allowMassDeactivation: boolean

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
        `${connector.key} : import${this.dryRun ? ' (dry-run)' : ''}, ` +
          (this.full ? 'catalogue entier…' : `${this.limit} produit(s) max…`)
      )
      try {
        const summary = await importer.import(connector, {
          limit: this.full ? null : this.limit,
          refresh: this.refresh,
          allowMassDeactivation: this.allowMassDeactivation,
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
    if (summary.deactivated > 0) {
      this.logger.warning(
        `${summary.deactivated} fiche(s) absente(s) du flux complet désactivée(s)`
      )
    }
    if (summary.deactivationSkipped > 0) {
      this.logger.warning(
        `${summary.deactivationSkipped} fiche(s) absente(s) du flux NON désactivée(s) : trop nombreuses, ` +
          'le flux est peut-être amputé. Vérifier, puis relancer avec --allow-mass-deactivation.'
      )
      this.exitCode = 1
    }
    if (summary.missingFeeds.length > 0) {
      this.logger.warning(
        `Flux annexes indisponibles (données correspondantes absentes) : ${summary.missingFeeds.join(', ')}`
      )
    }
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
