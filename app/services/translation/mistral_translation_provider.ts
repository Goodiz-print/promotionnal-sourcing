import { Mistral } from '@mistralai/mistralai'
import aiConfig from '#config/ai'
import { TranslationProviderError, TranslationTruncatedError } from '#exceptions/ai_errors'
import TranslationProvider from '#services/translation/translation_provider'
import type { MistralChatClientLike } from '#shared/types/ai'

function defaultClient(): MistralChatClientLike {
  return new Mistral({ apiKey: aiConfig.mistral.apiKey }) as unknown as MistralChatClientLike
}

/**
 * Traducteur Mistral (chat, réponse JSON). Toutes les langues cibles passent
 * dans **un seul** appel (#75) : la réponse est un objet `{ locale: { champ } }`
 * dont chaque locale et chaque champ demandés sont vérifiés.
 *
 * Le prompt est versionné par `aiConfig.translation.promptVersion` : le modifier
 * impose de bumper la version (elle entre dans la clé d'idempotence).
 */
export default class MistralTranslationProvider extends TranslationProvider {
  readonly model = aiConfig.translation.model

  constructor(private client: MistralChatClientLike = defaultClient()) {
    super()
  }

  async translate(
    fields: Record<string, string>,
    sourceLocale: string,
    targetLocales: string[]
  ): Promise<Record<string, Record<string, string>>> {
    const response = await this.client.chat.complete({
      model: this.model,
      temperature: 0,
      maxTokens: aiConfig.translation.maxTokens,
      responseFormat: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            `Translate the values of the JSON object from "${sourceLocale}" into each of these ` +
            `language codes: ${targetLocales.join(', ')}. ` +
            'Answer with one JSON object whose keys are the language codes and whose values ' +
            'are objects with the same keys as the input. ' +
            'Keep the keys unchanged. Preserve brand names, numbers, units and formatting. ' +
            'Answer with the JSON object only.',
        },
        { role: 'user', content: JSON.stringify(fields) },
      ],
    })

    const choice = response.choices[0]
    if (choice?.finishReason === 'length') throw new TranslationTruncatedError()

    const content = choice?.message.content
    if (typeof content !== 'string') throw new TranslationProviderError('empty response')

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new TranslationProviderError('invalid JSON')
    }

    const byLocale = (parsed ?? {}) as Record<string, unknown>
    const result: Record<string, Record<string, string>> = {}
    for (const locale of targetLocales) {
      const localized = byLocale[locale]
      if (typeof localized !== 'object' || localized === null) {
        throw new TranslationProviderError(`missing locale "${locale}"`)
      }

      const values: Record<string, string> = {}
      for (const key of Object.keys(fields)) {
        const value = (localized as Record<string, unknown>)[key]
        if (typeof value !== 'string') {
          throw new TranslationProviderError(`missing field "${key}" for "${locale}"`)
        }
        values[key] = value
      }
      result[locale] = values
    }
    return result
  }
}
