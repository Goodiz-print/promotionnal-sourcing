import { Mistral } from '@mistralai/mistralai'
import aiConfig from '#config/ai'
import { TranslationProviderError } from '#exceptions/ai_errors'
import TranslationProvider from '#services/translation/translation_provider'
import type { MistralChatClientLike } from '#shared/types/ai'

function defaultClient(): MistralChatClientLike {
  return new Mistral({ apiKey: aiConfig.mistral.apiKey }) as unknown as MistralChatClientLike
}

/**
 * Traducteur Mistral (chat, réponse JSON). Le prompt est versionné par
 * `aiConfig.translation.promptVersion` : le modifier impose de bumper la version.
 */
export default class MistralTranslationProvider extends TranslationProvider {
  readonly model = aiConfig.translation.model

  constructor(private client: MistralChatClientLike = defaultClient()) {
    super()
  }

  async translate(fields: Record<string, string>, sourceLocale: string, targetLocale: string) {
    const response = await this.client.chat.complete({
      model: this.model,
      temperature: 0,
      responseFormat: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            `Translate the values of the JSON object from "${sourceLocale}" to "${targetLocale}". ` +
            'Keep the keys unchanged. Preserve brand names, numbers, units and formatting. ' +
            'Answer with the JSON object only.',
        },
        { role: 'user', content: JSON.stringify(fields) },
      ],
    })

    const content = response.choices[0]?.message.content
    if (typeof content !== 'string') throw new TranslationProviderError('empty response')

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new TranslationProviderError('invalid JSON')
    }

    const result: Record<string, string> = {}
    for (const key of Object.keys(fields)) {
      const value = (parsed as Record<string, unknown> | null)?.[key]
      if (typeof value !== 'string') throw new TranslationProviderError(`missing field "${key}"`)
      result[key] = value
    }
    return result
  }
}
