import { inject } from '@adonisjs/core'
import Anthropic from '@anthropic-ai/sdk'
import aiConfig from '#config/ai'
import { TranslationProviderError, TranslationTruncatedError } from '#exceptions/ai_errors'
import TranslationProvider from '#services/translation/translation_provider'
import {
  claudeText,
  pickTranslations,
  translationSchema,
  translationShapeError,
  tryParseJson,
} from '#shared/helpers/llm'
import type { TranslationUsage } from '#shared/types/ai'

/**
 * Traducteur Claude (API Anthropic, sortie structurée). Même contrat que le
 * driver Mistral : toutes les langues cibles dans **un seul** appel (#75), réponse
 * `{ locale: { champ } }` dont chaque locale et chaque champ sont vérifiés.
 *
 * L'appel est diffusé (`stream` + `finalMessage`) : avec un plafond de sortie de
 * cette taille, le SDK refuse un appel non diffusé (risque de délai dépassé).
 *
 * Le prompt est versionné par `aiConfig.translation.promptVersion` : le modifier
 * impose de bumper la version (elle entre dans la clé d'idempotence).
 */
@inject()
export default class ClaudeTranslationProvider extends TranslationProvider {
  readonly model = aiConfig.translation.model

  constructor(private client: Anthropic) {
    super()
  }

  // Signature imposée par `TranslationProvider` (4 paramètres).
  // eslint-disable-next-line no-restricted-syntax
  async translate(
    fields: Record<string, string>,
    sourceLocale: string,
    targetLocales: string[],
    usage?: TranslationUsage
  ): Promise<Record<string, Record<string, string>>> {
    const keys = Object.keys(fields)
    const message = await this.request(fields, sourceLocale, targetLocales)

    if (usage) {
      usage.promptTokens = message.usage.input_tokens
      usage.completionTokens = message.usage.output_tokens
    }
    if (message.stop_reason === 'max_tokens') throw new TranslationTruncatedError()
    if (message.stop_reason === 'refusal') throw new TranslationProviderError('refusal')

    const text = claudeText(message.content)
    if (!text) throw new TranslationProviderError('empty response')
    const parsed = tryParseJson(text)
    if (parsed === undefined) throw new TranslationProviderError('invalid JSON')

    const problem = translationShapeError(parsed, keys, targetLocales)
    if (problem) throw new TranslationProviderError(problem)
    return pickTranslations(parsed as Record<string, Record<string, string>>, keys, targetLocales)
  }

  private request(fields: Record<string, string>, sourceLocale: string, targetLocales: string[]) {
    return this.client.messages
      .stream({
        model: this.model,
        max_tokens: aiConfig.translation.maxTokens,
        // Tâche simple et volumineuse : effort bas (moins de réflexion facturée).
        output_config: {
          effort: 'low',
          format: {
            type: 'json_schema',
            schema: translationSchema(Object.keys(fields), targetLocales),
          },
        },
        system:
          `Translate the values of the JSON object from "${sourceLocale}" into each of these ` +
          `language codes: ${targetLocales.join(', ')}. ` +
          'Answer with one JSON object whose keys are the language codes and whose values ' +
          'are objects with the same keys as the input. ' +
          'Keep the keys unchanged. Preserve brand names, numbers, units and formatting.',
        messages: [{ role: 'user', content: JSON.stringify(fields) }],
      })
      .finalMessage()
  }
}
