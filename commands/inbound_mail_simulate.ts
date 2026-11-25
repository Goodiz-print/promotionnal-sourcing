import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { inject } from '@adonisjs/core'
import InboundMailService from '#services/inbound_mail_service'
import type InboundMail from '#models/inbound_mail'
import type {
  InboundAttachmentDescriptor,
  InboundMailContent,
  InboundMailNotification,
  SimulatedInboundAttachment,
} from '#shared/types/inbound_mail'

/**
 * Simule la réception d'une réponse de fournisseur, sans prestataire ni file :
 * en développement il n'y a ni MX ni webhook. Le mail passe par les mêmes
 * garde-fous que la production et finit dans `inbound_mails`.
 *
 *   node ace inbound-mail:simulate rfq-<jeton>@reply.localhost \
 *     --from="Jean <jean@fournisseur.test>" --attachment=devis.pdf
 */
export default class InboundMailSimulate extends BaseCommand {
  static commandName = 'inbound-mail:simulate'
  static description = "Simule la réception d'un mail entrant à une adresse relais (développement)"

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Adresse relais visée (rfq-<jeton>@<domaine relais>)' })
  declare to: string

  @flags.string({ description: 'Expéditeur', default: 'fournisseur@example.test' })
  declare from: string

  @flags.string({ description: 'Objet', default: 'Re: demande de devis' })
  declare subject: string

  @flags.string({ description: 'Corps texte', default: 'Bonjour, voici notre devis.' })
  declare text: string

  @flags.array({ description: 'Fichier à joindre (répétable)' })
  declare attachment?: string[]

  @flags.boolean({ description: "Marque le mail comme une réponse automatique d'absence" })
  declare autoReply: boolean

  @inject()
  async run(inboundMails: InboundMailService) {
    if (this.app.inProduction) {
      this.logger.error('Commande réservée au développement')
      this.exitCode = 1
      return
    }

    // Comme `queue:work` : hors serveur HTTP, les routes ne sont pas figées et
    // `urlFor` échoue (liens du mail transmis à l'agence, #225).
    const router = await this.app.container.make('router')
    router.commit()

    const files = await this.readAttachments()
    const mail = await inboundMails.ingest(
      this.notification(),
      this.content(files),
      async (attachment) => files.get(attachment.id)!.content
    )
    this.report(mail)
  }

  private async readAttachments(): Promise<Map<string, SimulatedInboundAttachment>> {
    const read = await Promise.all(
      (this.attachment ?? []).map(async (path) => ({
        filename: basename(path),
        content: await readFile(path),
      }))
    )
    return new Map(read.map((file) => [randomUUID(), file]))
  }

  private notification(): InboundMailNotification {
    return {
      providerMessageId: randomUUID(),
      recipients: [this.to],
      from: this.from,
      subject: this.subject,
      messageId: `<${randomUUID()}@simulated.test>`,
      receivedAt: new Date().toISOString(),
    }
  }

  private content(files: Map<string, SimulatedInboundAttachment>): InboundMailContent {
    const attachments: InboundAttachmentDescriptor[] = [...files].map(([id, file]) => ({
      id,
      filename: file.filename,
      contentType: null,
      sizeBytes: file.content.length,
      inline: false,
    }))
    return {
      text: this.text,
      html: null,
      headers: this.autoReply ? { 'auto-submitted': 'auto-replied' } : {},
      sizeBytes: null,
      attachments,
    }
  }

  private report(mail: InboundMail) {
    const reason = mail.rejectionReason ? ` (${mail.rejectionReason})` : ''
    this.logger.info(`Mail #${mail.id} : ${mail.status}${reason}`)
    mail.attachments.forEach((attachment) =>
      this.logger.info(`  pièce jointe ${attachment.filename} : ${attachment.status}`)
    )
  }
}
