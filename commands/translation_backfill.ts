import { inject } from '@adonisjs/core'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import aiConfig from '#config/ai'
import TranslationBackfillService from '#services/translation_backfill_service'
import { TRANSLATABLE_ENTITIES, type TranslatableEntity } from '#shared/types/ai'

/**
 * Met en file la traduction automatique des contenus existants (#97) vers les
 * langues de contenu manquantes : `node ace translation:backfill`.
 *
 * Sûre à relancer : une langue déjà traduite à jour ne rappelle pas l'IA, une
 * traduction saisie à la main n'est jamais écrasée. `--limit` permet de mesurer
 * le coût réel sur un échantillon avant un passage en masse.
 */
export default class TranslationBackfill extends BaseCommand {
  static commandName = 'translation:backfill'
  static description =
    'Met en file la traduction des contenus existants vers les langues manquantes'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.number({ description: "Nombre maximum d'entités par type (échantillon)" })
  declare limit?: number

  @flags.array({ description: `Types à traiter (${TRANSLATABLE_ENTITIES.join(', ')})` })
  declare entity?: string[]

  @inject()
  async run(backfill: TranslationBackfillService) {
    if (!aiConfig.translation.enabled) {
      this.logger.warning('AI_TRANSLATION_ENABLED est désactivé : activez-le, puis relancez.')
      return
    }

    const unknown = (this.entity ?? []).filter(
      (entity) => !(TRANSLATABLE_ENTITIES as readonly string[]).includes(entity)
    )
    if (unknown.length > 0) {
      this.logger.error(`Type inconnu : ${unknown.join(', ')}`)
      this.exitCode = 1
      return
    }

    this.logger.info('Mise en file des traductions…')
    const report = await backfill.backfill({
      entities: this.entity as TranslatableEntity[] | undefined,
      limit: this.limit,
    })
    for (const entity of TRANSLATABLE_ENTITIES) {
      this.logger.info(`${entity} : ${report[entity]} mis en file`)
    }
    this.logger.success('Terminé : les traductions sont générées par le worker de queue.')
  }
}
