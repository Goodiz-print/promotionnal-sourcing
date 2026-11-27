import QueueWork from '@adonisjs/queue/commands/queue_work'
import env from '#start/env'
import WorkerProbeService from '#services/worker_probe_service'

/**
 * `queue:work` + sonde HTTP `GET /health` sur `HOST:PORT`.
 *
 * Commande du worker sur Clever Cloud, où un conteneur sans serveur HTTP est
 * considéré en échec (cf. docs/deploiement.md). Accepte les mêmes options que
 * `queue:work` (`--queue`, `--concurrency`…). En local, `queue:work` suffit.
 */
export default class QueueServe extends QueueWork {
  static commandName = 'queue:serve'
  static description = 'Démarre le worker de queue avec une sonde HTTP GET /health (Clever Cloud)'

  async run() {
    const probe = await this.app.container.make(WorkerProbeService)
    const host = env.get('HOST')

    let port: number
    try {
      port = await probe.start(env.get('PORT'), host)
    } catch (error) {
      // Sans sonde, la plateforme tuerait le conteneur : on échoue tout de suite,
      // avec un code de sortie non nul (une commande `staysAlive` sortirait en 0).
      this.logger.error(`Sonde du worker indisponible : ${(error as Error).message}`)
      this.exitCode = 1
      return this.terminate()
    }

    this.app.terminating(() => probe.stop())
    this.logger.info(`Sonde du worker : http://${host}:${port}/health`)

    await super.run()
  }
}
