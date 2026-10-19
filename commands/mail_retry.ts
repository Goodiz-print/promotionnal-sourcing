import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { inject } from '@adonisjs/core'
import SendMailJob from '#jobs/send_mail_job'
import MailDeliveryService from '#services/mail_delivery_service'

/**
 * Rejeu depuis la dead-letter `mail_deliveries` (#59) : remet en queue, avec la
 * même clé d'idempotence, les mails restés `failed`. Un mail déjà `sent` n'est
 * jamais renvoyé (le job sort silencieusement).
 */
export default class MailRetry extends BaseCommand {
  static commandName = 'mail:retry'
  static description =
    "Rejoue un mail en échec depuis la dead-letter (clé d'idempotence ou --all-failed)"

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: "Clé d'idempotence du mail à rejouer", required: false })
  declare idempotencyKey?: string

  @flags.boolean({ description: 'Rejoue tous les mails en échec' })
  declare allFailed: boolean

  @inject()
  async run(deliveries: MailDeliveryService) {
    if (!this.idempotencyKey === !this.allFailed) {
      this.logger.error("Indiquer soit une clé d'idempotence, soit --all-failed")
      this.exitCode = 1
      return
    }

    const failed = await deliveries.failed(this.allFailed ? undefined : this.idempotencyKey)
    if (failed.length === 0) {
      this.logger.info('Aucun mail en échec à rejouer')
      if (!this.allFailed) this.exitCode = 1
      return
    }

    let requeued = 0
    for (const delivery of failed) {
      if (!delivery.payload) {
        this.logger.error(`${delivery.idempotencyKey} : charge indisponible, rejeu impossible`)
        this.exitCode = 1
        continue
      }
      await SendMailJob.dispatch(delivery.payload)
      requeued += 1
      this.logger.info(`${delivery.idempotencyKey} : remis en queue`)
    }
    this.logger.success(`${requeued} mail(s) remis en queue`)
  }
}
