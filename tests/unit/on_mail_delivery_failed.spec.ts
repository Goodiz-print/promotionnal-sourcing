import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import MailDeliveryFailed from '#events/mail_delivery_failed'
import OnMailDeliveryFailed from '#listeners/on_mail_delivery_failed'
import MailDeliveryFailedAlert from '#mails/mail_delivery_failed_alert'

const EVENT = new MailDeliveryFailed({
  idempotencyKey: 'rfq-received:org=7:rfq=12',
  kind: 'rfq-received',
  to: 'contact@fournisseur.test',
  error: 'ECONNREFUSED',
  attempts: 6,
})

test.group('OnMailDeliveryFailed', (group) => {
  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    return () => mail.restore()
  })

  test('envoie l’alerte à MAIL_ALERT_ADDRESS', async () => {
    await new OnMailDeliveryFailed('ops@example.com').handle(EVENT)

    fakeMailer.mails.assertSent(
      MailDeliveryFailedAlert,
      (sent) => (sent as unknown as { email: string }).email === 'ops@example.com'
    )
  })

  test('sans MAIL_ALERT_ADDRESS : log seul, aucun mail', async () => {
    await new OnMailDeliveryFailed(undefined).handle(EVENT)
    fakeMailer.mails.assertNoneSent()
  })

  test('un échec de l’alerte ne remonte pas', async ({ assert }) => {
    fakeMailer.send = async () => {
      throw new Error('smtp down')
    }
    await assert.doesNotReject(() => new OnMailDeliveryFailed('ops@example.com').handle(EVENT))
  })
})
