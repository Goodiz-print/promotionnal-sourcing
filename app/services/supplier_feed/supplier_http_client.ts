import logger from '@adonisjs/core/services/logger'
import supplierFeedsConfig from '#config/supplier_feeds'
import { SupplierFeedHttpException } from '#exceptions/supplier_feed_errors'
import { redactUrl } from '#shared/helpers/supplier_feed'

/** URL masquée, y compris les valeurs exactes des secrets configurés. */
function redact(url: string): string {
  return redactUrl(url, [
    supplierFeedsConfig.pfconcept.feedCode,
    supplierFeedsConfig.passot.apiKey,
    supplierFeedsConfig.inspirion.apiKey,
    supplierFeedsConfig.axpol.apiKey,
  ])
}

/**
 * Client HTTP des flux fournisseurs : timeout, nouvel essai sur 5xx / erreur
 * réseau, parsing JSON. Ne journalise **jamais** l'URL en clair ni les
 * en-têtes (ils portent les clés d'API). Remplacé par un faux en test
 * (`container.swap` ou injection directe).
 */
export default class SupplierHttpClient {
  async getJson<T = unknown>(url: string, headers: Record<string, string> = {}): Promise<T> {
    const response = await this.request(url, { Accept: 'application/json', ...headers })
    try {
      return (await response.json()) as T
    } catch {
      throw new SupplierFeedHttpException(`Réponse JSON illisible pour ${redact(url)}`)
    }
  }

  async getBuffer(url: string): Promise<{ content: Buffer; mimeType: string }> {
    const response = await this.request(url, {})
    return {
      content: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get('content-type') ?? 'application/octet-stream',
    }
  }

  private async request(url: string, headers: Record<string, string>): Promise<Response> {
    const { timeoutMs, retries, userAgent } = supplierFeedsConfig.http
    let failure = `Flux injoignable : ${redact(url)}`

    for (let attempt = 0; attempt <= retries; attempt++) {
      let response: Response
      try {
        response = await fetch(url, {
          headers: { 'User-Agent': userAgent, ...headers },
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch {
        // Erreur réseau ou timeout : on retente. Le message d'origine peut
        // contenir l'URL, on ne journalise que sa version masquée.
        logger.warn({ url: redact(url), attempt }, 'supplier feed unreachable, retrying')
        continue
      }
      if (response.ok) return response
      failure = `HTTP ${response.status} pour ${redact(url)}`
      // 4xx : inutile de retenter (clé refusée, flux inexistant…).
      if (response.status < 500) break
      logger.warn({ url: redact(url), attempt, status: response.status }, 'supplier feed 5xx')
    }

    throw new SupplierFeedHttpException(failure)
  }
}
