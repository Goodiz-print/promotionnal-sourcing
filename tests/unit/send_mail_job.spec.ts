import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import SendMailJob from '#jobs/send_mail_job'
import OrganizationInvitationNotification from '#mails/organization_invitation_notification'
import PasswordResetNotification from '#mails/password_reset_notification'
import RfqReceivedNotification from '#mails/rfq_received_notification'
import { MAIL_KINDS, type SendMailPayload } from '#shared/types/mail'

const PAYLOAD: SendMailPayload = {
  kind: MAIL_KINDS.organizationInvitation,
  to: 'invited@example.com',
  data: {
    organizationName: 'Acme',
    roleName: 'Membre',
    inviterName: 'Owner Example',
    acceptUrl: 'https://example.test/fr/organization/invitations/1?signature=abc',
  },
}

/**
 * Instancie le job comme le ferait le worker : `$hydrate` fournit la charge
 * désérialisée depuis `queue_jobs` et le contexte d'exécution.
 */
function jobFor(payload: SendMailPayload, attempt = 1) {
  const job = new SendMailJob()
  job.$hydrate(payload, {
    jobId: 'job-test',
    name: 'SendMailJob',
    attempt,
    queue: 'default',
    priority: 5,
    acquiredAt: new Date(),
    stalledCount: 0,
  })
  return job
}

test.group('SendMailJob', (group) => {
  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    return () => mail.restore()
  })

  test("reconstruit le mail d'invitation depuis la charge et l'envoie", async () => {
    await jobFor(PAYLOAD).execute()

    // `send` et non `sendLater` : la file, c'est la queue — pas celle de
    // `@adonisjs/mail`, qui vit en mémoire et se perd au redémarrage.
    fakeMailer.mails.assertNoneQueued()
    fakeMailer.mails.assertSent(OrganizationInvitationNotification, (sent) => {
      const fields = sent as unknown as Record<string, string>
      return (
        fields.email === 'invited@example.com' &&
        fields.organizationName === 'Acme' &&
        fields.roleName === 'Membre' &&
        fields.inviterName === 'Owner Example' &&
        fields.acceptUrl === PAYLOAD.data.acceptUrl
      )
    })
  })

  test('reconstruit le mail de demande de devis depuis la charge', async () => {
    const payload: SendMailPayload = {
      kind: MAIL_KINDS.rfqReceived,
      to: 'contact@fournisseur.test',
      data: {
        buyerName: 'Acme',
        rfqTitle: 'Tote bags coton bio',
        itemCount: 2,
        deadline: '30/09/2026',
        rfqPath: '/fr/supplier/rfqs/12',
      },
    }

    await jobFor(payload).execute()

    fakeMailer.mails.assertSent(RfqReceivedNotification, (sent) => {
      const fields = sent as unknown as Record<string, unknown>
      return (
        fields.email === 'contact@fournisseur.test' &&
        fields.buyerName === 'Acme' &&
        fields.rfqTitle === 'Tote bags coton bio' &&
        fields.itemCount === 2 &&
        fields.rfqPath === '/fr/supplier/rfqs/12'
      )
    })
  })

  test('reconstruit le mail de réinitialisation de mot de passe depuis la charge', async () => {
    const payload: SendMailPayload = {
      kind: MAIL_KINDS.passwordReset,
      to: 'membre@example.com',
      data: {
        resetUrl: 'https://example.test/fr/password/reset/1?signature=abc',
        expiresInMinutes: 60,
      },
    }

    await jobFor(payload).execute()

    fakeMailer.mails.assertSent(PasswordResetNotification, (sent) => {
      const fields = sent as unknown as Record<string, unknown>
      return (
        fields.email === 'membre@example.com' &&
        fields.resetUrl === payload.data.resetUrl &&
        fields.expiresInMinutes === 60
      )
    })
  })

  test('une panne SMTP fait échouer le job pour que la queue le rejoue', async ({ assert }) => {
    fakeMailer.send = async () => {
      throw new Error('ECONNREFUSED 127.0.0.1:1025')
    }

    await assert.rejects(() => jobFor(PAYLOAD, 2).execute(), 'ECONNREFUSED 127.0.0.1:1025')
  })

  test('une charge de type inconnu fait échouer le job explicitement', async ({ assert }) => {
    const corrupted = { ...PAYLOAD, kind: 'unknown-mail' } as unknown as SendMailPayload

    await assert.rejects(
      () => jobFor(corrupted).execute(),
      'Unknown transactional mail kind "unknown-mail"'
    )
    fakeMailer.mails.assertNoneSent()
  })

  test('la politique de retry est déclarée sur le job', ({ assert }) => {
    assert.equal(SendMailJob.options.retry?.maxRetries, 5)
    assert.isFunction(SendMailJob.options.retry?.backoff)
  })

  test('failed() loggue sans relancer (dernière tentative épuisée)', async ({ assert }) => {
    const job = jobFor(PAYLOAD, 6)
    await assert.doesNotReject(() => job.failed(new Error('ECONNREFUSED')))
  })
})
