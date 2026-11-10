import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * Sonde HTTP du worker de queue.
 *
 * Clever Cloud exige qu'une application Docker écoute en HTTP (port 8080) pour
 * considérer un déploiement comme réussi ; le worker n'a aucun serveur web.
 * Cette sonde répond 200 sur `GET /health` tant que le processus tourne.
 *
 * Sonde de vie seulement : elle ne regarde ni la base ni le backlog. Un retard
 * de la queue ne doit pas faire échouer un déploiement ni redémarrer le worker
 * (c'est le rôle de `node ace queue:health`, cf. docs/queue.md).
 */
export default class WorkerProbeService {
  #server: Server | null = null

  /**
   * Démarre la sonde et rend le port réellement écouté (`0` = port libre).
   */
  start(port: number, host: string): Promise<number> {
    const server = createServer((request, response) => {
      const path = (request.url ?? '').split('?')[0]
      const found = request.method === 'GET' && path === '/health'

      response.writeHead(found ? 200 : 404, { 'content-type': 'application/json' })
      response.end(JSON.stringify(found ? { status: 'ok' } : { status: 'not_found' }))
    })

    return new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, host, () => {
        server.off('error', reject)
        this.#server = server
        resolve((server.address() as AddressInfo).port)
      })
    })
  }

  stop(): Promise<void> {
    const server = this.#server
    this.#server = null
    if (!server) return Promise.resolve()

    return new Promise((resolve) => {
      server.close(() => resolve())
      // Une connexion keep-alive de l'équilibreur ne doit pas retarder l'arrêt.
      server.closeAllConnections()
    })
  }
}
