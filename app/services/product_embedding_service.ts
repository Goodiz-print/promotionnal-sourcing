import { Mistral } from '@mistralai/mistralai'
import env from '#start/env'
import { EmbeddingGenerationError } from '#exceptions/embedding_errors'

const EMBEDDING_MODEL = 'mistral-embed'

/**
 * Genere des embeddings via l'API Mistral (`mistral-embed`, 1024 dims).
 * Le client est injectable pour les tests (zero appel reseau, cf.
 * tests/unit/product_embedding_service.spec.ts).
 */
export default class ProductEmbeddingService {
  #client: Pick<Mistral, 'embeddings'>

  constructor(client?: Pick<Mistral, 'embeddings'>) {
    this.#client = client ?? this.#buildClient()
  }

  #buildClient(): Mistral {
    const apiKey = env.get('MISTRAL_API_KEY')

    if (!apiKey) {
      throw new EmbeddingGenerationError(
        'MISTRAL_API_KEY manquante : impossible de generer un embedding'
      )
    }

    return new Mistral({ apiKey })
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.#client.embeddings.create({
      model: EMBEDDING_MODEL,
      inputs: [text],
    })

    const embedding = response.data[0]?.embedding

    if (!embedding || embedding.length === 0) {
      throw new EmbeddingGenerationError('Reponse Mistral sans embedding exploitable')
    }

    return embedding
  }
}
