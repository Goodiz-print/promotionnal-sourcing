import { inject } from '@adonisjs/core'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import searchConfig from '#config/search'
import ProductIndexService from '#services/product_index_service'
import SearchEvaluationService from '#services/search/search_evaluation_service'

/**
 * Rejoue le jeu de requêtes de référence sur l'index (ADR 0002, décision 8) et
 * affiche rappel@10 et latences : `node ace search:evaluate`. À lancer sur une
 * base semée (`db:seed`) et un Elasticsearch joignable ; `--reindex` reconstruit
 * l'index avant de mesurer. Sort en erreur si une requête échoue.
 */
export default class SearchEvaluate extends BaseCommand {
  static commandName = 'search:evaluate'
  static description = 'Rejoue le jeu de requêtes de référence et mesure rappel et latence'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: "Reconstruit l'index avant de mesurer" })
  declare reindex: boolean

  @inject()
  async run(index: ProductIndexService, evaluation: SearchEvaluationService) {
    if (!searchConfig.enabled) {
      this.logger.warning('ELASTICSEARCH_URL est absent : renseignez-le, puis relancez.')
      this.exitCode = 1
      return
    }

    if (this.reindex) {
      this.logger.info('Réindexation…')
      this.logger.info(`${await index.reindexAll()} produit(s) indexé(s).`)
    }

    const report = await evaluation.evaluate()

    const table = this.ui.table().head(['Requête', 'Famille', 'Verdict', 'Rappel@10', 'ms'])
    for (const result of report.results) {
      table.row([
        result.id,
        result.kind,
        result.status,
        result.status === 'skipped' ? '—' : result.recallAt10.toFixed(2),
        result.status === 'skipped' ? '—' : String(Math.round(result.latencyMs)),
      ])
    }
    table.render()

    for (const result of report.results.filter((entry) => entry.status === 'failed')) {
      this.logger.error(
        `${result.id} : manque [${result.missing.join(', ')}], en trop [${result.unexpected.join(', ')}]`
      )
    }

    this.logger.info(
      `Rappel@10 moyen ${report.recallAt10.toFixed(2)} — ${report.passed} réussie(s), ` +
        `${report.failed} en échec, ${report.skipped} ignorée(s) — ` +
        `latence p50 ${Math.round(report.latencyP50Ms)} ms, p95 ${Math.round(report.latencyP95Ms)} ms`
    )
    if (report.failed > 0) this.exitCode = 1
  }
}
