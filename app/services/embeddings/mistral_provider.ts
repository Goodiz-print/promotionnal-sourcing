import { Mistral } from '@mistralai/mistralai'
import aiConfig from '#config/ai'
import { EmbeddingProviderError } from '#exceptions/ai_errors'
import EmbeddingProvider from '#services/embeddings/embedding_provider'

/**
 * Sous-ensemble de l'API Mistral dont dépend ce driver (injectable en test).
 */
export interface MistralClientLike {
  embeddings: {
    create(request: {
      model: string
      inputs: string[]
      outputDimension?: number
    }): Promise<{ data: Array<{ embedding?: number[] }> }>
  }
}

function defaultClient(): MistralClientLike {
  return new Mistral({ apiKey: aiConfig.mistral.apiKey }) as unknown as MistralClientLike
}

/**
 * Driver d'embeddings Mistral (SDK natif). Demande la dimension configurée via
 * `outputDimension` (réduction côté API).
 */
export default class MistralEmbeddingProvider extends EmbeddingProvider {
  readonly name = 'mistral' as const

  constructor(private client: MistralClientLike = defaultClient()) {
    super()
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: aiConfig.mistral.model,
      inputs: [text],
      outputDimension: aiConfig.embeddings.dimensions,
    })

    const embedding = response.data[0]?.embedding
    if (!embedding) throw new EmbeddingProviderError('mistral', 'empty response')
    return embedding
  }
}
