import { urlFor } from '@adonisjs/core/services/url_builder'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import OrganizationUser from '#models/organization_user'
import SendMailJob from '#jobs/send_mail_job'
import { MAIL_KINDS } from '#shared/types/mail'
import { RFQ_RESPONDER_ROLES } from '#shared/types/rfq'
import type Organization from '#models/organization'
import type Rfq from '#models/rfq'
import type RfqSupplier from '#models/rfq_supplier'

/**
 * Notification des destinataires d'une demande de devis, au moment où
 * l'acheteur la diffuse (`RfqService#send`).
 *
 * Séparé de `RfqService` volontairement : le service porte la machine à états,
 * qui doit rester testable sans queue ni SMTP. Ici on ne fait que traduire
 * « ces destinataires viennent de passer en `sent` » en mails mis en queue.
 *
 * Pas de risque de relance en boucle : `send()` ne bascule que les `pending`,
 * et ne renvoie que les lignes réellement basculées. Un second clic sur
 * « envoyer » est refusé par la machine à états, pas rattrapé ici.
 */
export default class RfqNotificationService {
  /**
   * Met en queue un mail par adresse destinataire. Renvoie le nombre de mails
   * mis en queue — utile aux tests et aux logs, l'écran comptant les
   * *organisations* notifiées.
   *
   * Un échec de mise en queue (base indisponible) est **loggué sans être
   * propagé** : les statuts sont déjà basculés côté acheteur, et la demande
   * apparaît de toute façon dans l'écran « demandes reçues » du fournisseur —
   * faire échouer la requête laisserait un état incohérent pour un canal qui
   * n'est qu'un rappel.
   */
  async notifyRecipients(
    rfq: Rfq,
    buyer: Organization,
    recipients: RfqSupplier[],
    locale: string
  ): Promise<number> {
    if (recipients.length === 0) return 0

    const rfqPath = urlFor('supplier.rfqs.show', { locale, id: rfq.id })
    const deadline = rfq.deadline?.setLocale(locale).toLocaleString() ?? null
    const itemCount = await this.countItems(rfq)
    let queued = 0

    for (const recipient of recipients) {
      const emails = await this.emailsFor(recipient)

      for (const email of emails) {
        try {
          await SendMailJob.dispatch({
            kind: MAIL_KINDS.rfqReceived,
            to: email,
            data: {
              buyerName: buyer.name,
              rfqTitle: rfq.title,
              itemCount,
              deadline,
              rfqPath,
            },
          })
          queued += 1
        } catch (error) {
          logger.warn(
            { err: error, rfqId: rfq.id, supplierOrganizationId: recipient.supplierOrganizationId },
            'failed to queue rfq notification'
          )
        }
      }
    }

    return queued
  }

  /**
   * Compté plutôt que lu sur `rfq.items` : le service ne suppose rien des
   * relations préchargées par l'appelant.
   */
  private async countItems(rfq: Rfq): Promise<number> {
    const [{ total }] = await db.from('rfq_items').where('rfq_id', rfq.id).count('* as total')
    return Number(total)
  }

  /**
   * Adresses à prévenir pour un destinataire.
   *
   * L'adresse de contact de l'organisation prime quand elle est renseignée :
   * c'est celle que le fournisseur a lui-même déclarée pour être joint. À
   * défaut, on prévient les membres qui peuvent effectivement répondre
   * (`RFQ_RESPONDER_ROLES`, mêmes rôles que `canRespondToRfq`) — notifier un
   * `member`, qui n'a pas accès à l'écran, serait une impasse.
   *
   * Suppose `supplierOrganization` préchargé, ce que garantit
   * `RfqService#send` sur les lignes qu'il renvoie.
   */
  private async emailsFor(recipient: RfqSupplier): Promise<string[]> {
    const contactEmail = recipient.supplierOrganization.email
    if (contactEmail) return [contactEmail]

    const memberships = await OrganizationUser.query()
      .where('organizationId', recipient.supplierOrganizationId)
      .whereHas('role', (role) => role.whereIn('slug', [...RFQ_RESPONDER_ROLES]))
      .preload('user')

    return [...new Set(memberships.map((membership) => membership.user.email))]
  }
}
