import type ProductContentUpdated from '#events/product_content_updated'
import GenerateProductEmbeddingJob from '#jobs/generate_product_embedding_job'

export default class OnProductContentUpdated {
  async handle(event: ProductContentUpdated) {
    await GenerateProductEmbeddingJob.dispatch({ productId: event.productId })
  }
}
