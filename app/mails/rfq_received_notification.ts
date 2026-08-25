import { BaseMail } from '@adonisjs/mail'

/**
 * Mail « nouvelle demande de devis », envoyé à un destinataire au moment où
 * l'acheteur diffuse sa demande (`RfqService#send`).
 *
 * Le sujet est posé dans `prepare()` et non via la propriété `subject` : il
 * porte le nom de l'acheteur, qui n'est connu qu'à l'instanciation. `build()`
 * appelle `defineSubject()` **avant** `prepare()`, l'appel explicite gagne donc.
 *
 * `rfqPath` est relatif — le template le préfixe avec le global `appUrl`
 * (cf. `shared/types/mail.ts`).
 */
export default class RfqReceivedNotification extends BaseMail {
  constructor(
    private email: string,
    private buyerName: string,
    private rfqTitle: string,
    private itemCount: number,
    private deadline: string | null,
    private rfqPath: string
  ) {
    super()
  }

  prepare() {
    this.message
      .to(this.email)
      .subject(`Nouvelle demande de devis de ${this.buyerName}`)
      .htmlView('emails/rfq_received', {
        buyerName: this.buyerName,
        rfqTitle: this.rfqTitle,
        itemCount: this.itemCount,
        deadline: this.deadline,
        rfqPath: this.rfqPath,
      })
  }
}
