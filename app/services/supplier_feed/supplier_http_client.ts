import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import supplierFeedsConfig from '#config/supplier_feeds'
import { SupplierFeedHttpException } from '#exceptions/supplier_feed_errors'
import { redactUrl } from '#shared/helpers/supplier_feed'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import type { FeedCacheOptions } from '#shared/types/supplier_feed'

/** URL masquée, y compris les valeurs exactes des secrets configurés. */
function redact(url: string): string {
  return redactUrl(url, [
    supplierFeedsConfig.pfconcept.feedCode,
    supplierFeedsConfig.passot.apiKey,
    supplierFeedsConfig.inspirion.apiKey,
    supplierFeedsConfig.makito.password,
  ])
}

/**
 * Client HTTP des flux fournisseurs : timeout, nouvel essai sur 5xx / erreur
 * réseau, parsing JSON. Ne journalise **jamais** l'URL en clair, les en-têtes
 * ni le corps envoyé (ils portent les clés d'API et mots de passe). Remplacé
 * par un faux en test (`container.swap` ou injection directe).
 */
export default class SupplierHttpClient {
  /**
   * Flux JSON. Avec `cache`, la réponse est d'abord écrite en flux dans
   * `tmp/supplier_feeds/` (jamais commité : elle contient des prix nets) et
   * réutilisée tant qu'elle a moins de `http.cacheTtlMs` : un import complet
   * relancé (dry-run puis écriture) ne retélécharge pas des flux de plusieurs
   * centaines de Mo. `cache.refresh` force le téléchargement.
   */
  async getJson<T = unknown>(
    url: string,
    headers: Record<string, string> = {},
    cache?: FeedCacheOptions
  ): Promise<T> {
    const requestHeaders = { Accept: 'application/json', ...headers }
    if (cache) return this.cachedJson<T>(url, requestHeaders, cache)
    const response = await this.request(url, { headers: requestHeaders })
    try {
      return (await response.json()) as T
    } catch {
      throw new SupplierFeedHttpException(`Réponse JSON illisible pour ${redact(url)}`)
    }
  }

  /** `POST` JSON (authentification par identifiants). Jamais mis en cache. */
  async postJson<T = unknown>(
    url: string,
    body: unknown,
    headers: Record<string, string> = {}
  ): Promise<T> {
    const response = await this.request(url, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
    try {
      return (await response.json()) as T
    } catch {
      throw new SupplierFeedHttpException(`Réponse JSON illisible pour ${redact(url)}`)
    }
  }

  async getBuffer(url: string): Promise<{ content: Buffer; mimeType: string }> {
    const response = await this.request(url, { headers: {} })
    return {
      content: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get('content-type') ?? 'application/octet-stream',
    }
  }

  private async cachedJson<T>(
    url: string,
    headers: Record<string, string>,
    { refresh, scope }: FeedCacheOptions
  ): Promise<T> {
    const directory = app.makePath('tmp', 'supplier_feeds')
    // Nom de fichier = empreinte de l'URL et du compte (en-têtes, ou `scope` si
    // le jeton change à chaque exécution) : aucun secret en clair.
    const key = createHash('sha256')
      .update(JSON.stringify([url, scope ?? headers]))
      .digest('hex')
    const path = join(directory, `${key}.json`)

    const fresh =
      !refresh &&
      (await stat(path).then(
        (file) => Date.now() - file.mtimeMs < supplierFeedsConfig.http.cacheTtlMs,
        () => false
      ))
    if (!fresh) {
      const response = await this.request(url, { headers })
      if (!response.body) {
        throw new SupplierFeedHttpException(`Réponse vide pour ${redact(url)}`)
      }
      await mkdir(directory, { recursive: true })
      // Fichier partiel puis renommage : un téléchargement interrompu ne laisse
      // jamais un cache tronqué.
      const partial = `${path}.${process.pid}.part`
      try {
        await pipeline(
          Readable.fromWeb(response.body as unknown as NodeReadableStream),
          createWriteStream(partial)
        )
        await rename(partial, path)
      } catch {
        await rm(partial, { force: true })
        throw new SupplierFeedHttpException(`Téléchargement interrompu pour ${redact(url)}`)
      }
    }

    try {
      return JSON.parse(await readFile(path, 'utf8')) as T
    } catch {
      await rm(path, { force: true })
      throw new SupplierFeedHttpException(`Réponse JSON illisible pour ${redact(url)}`)
    }
  }

  private async request(
    url: string,
    init: { method?: string; headers: Record<string, string>; body?: string }
  ): Promise<Response> {
    const { timeoutMs, retries, userAgent } = supplierFeedsConfig.http
    let failure = `Flux injoignable : ${redact(url)}`

    for (let attempt = 0; attempt <= retries; attempt++) {
      let response: Response
      try {
        response = await fetch(url, {
          method: init.method ?? 'GET',
          headers: { 'User-Agent': userAgent, ...init.headers },
          body: init.body,
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
