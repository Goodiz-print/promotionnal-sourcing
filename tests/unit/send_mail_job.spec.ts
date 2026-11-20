import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import mail from '@adonisjs/mail/services/main'
import SendMailJob from '#jobs/send_mail_job'
import OrganizationInvitationNotification from '#mails/organization_invitation_notification'
import EmailVerificationNotification from '#mails/email_verification_notification'
import PasswordResetNotification from '#mails/password_reset_notification'
import RfqReceivedNotification from '#mails/rfq_received_notification'
import ContactRequestNotification from '#mails/contact_request_notification'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'
import MailDeliveryFailed from '#events/mail_delivery_failed'
import MailDeliveryService from '#services/mail_delivery_service'
import { useDatabase } from '#tests/utils/setup'
import { MAIL_KINDS, type SendMailPayload } from '#shared/types/mail'

const PAYLOAD = {
  idempotencyKey: 'organization-invitation:invitation=1:send=test',
  kind: MAIL_KINDS.organizationInvitation,
  to: 'invited@example.com',
  locale: 'fr',
  data: {
    organizationName: 'Acme',
    roleName: 'Membre',
    inviterName: 'Owner Example',
    acceptUrl: 'https://example.test/fr/organization/invitations/1?signature=abc',
  },
} satisfies SendMailPayload

/**
 * Instancie le job comme le ferait le worker : `$hydrate` fournit la charge
 * désérialisée depuis `queue_jobs` et le contexte d'exécution.
 */
async function jobFor(payload: SendMailPayload, attempt = 1) {
  const job = await app.container.make(SendMailJob)
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

async function runJob(payload: SendMailPayload, attempt = 1) {
  const job = await jobFor(payload, attempt)
  return job.execute()
}

async function failJob(error: Error, payload: SendMailPayload, attempt = 1) {
  const job = await jobFor(payload, attempt)
  return job.failed(error)
}

test.group('SendMailJob', (group) => {
  useDatabase(group, { seed: 'none' })

  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    return () => mail.restore()
  })

  test('le mail est reconstruit dans la langue portée par la charge', async () => {
    await runJob({ ...PAYLOAD, locale: 'en' })

    fakeMailer.mails.assertSent(OrganizationInvitationNotification, (sent) => {
      return (sent as unknown as { locale: string }).locale === 'en'
    })
  })

  test('une charge mise en queue avant #58 (sans langue) retombe sur le français', async () => {
    const legacy: Record<string, unknown> = { ...PAYLOAD, idempotencyKey: 'legacy:no-locale' }
    delete legacy.locale
    await runJob(legacy as unknown as SendMailPayload)

    fakeMailer.mails.assertSent(OrganizationInvitationNotification, (sent) => {
      return (sent as unknown as { locale: string }).locale === 'fr'
    })
  })

  test("reconstruit le mail d'invitation depuis la charge et l'envoie", async () => {
    await runJob(PAYLOAD)

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
    const payload = {
      idempotencyKey: 'test:rfqReceived',
      kind: MAIL_KINDS.rfqReceived,
      to: 'contact@fournisseur.test',
      locale: 'fr',
      data: {
        buyerName: 'Acme',
        rfqTitle: 'Tote bags coton bio',
        itemCount: 2,
        deadline: '30/09/2026',
        rfqPath: '/fr/supplier/rfqs/12',
      },
    } satisfies SendMailPayload

    await runJob(payload)

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
    const payload = {
      idempotencyKey: 'test:passwordReset',
      kind: MAIL_KINDS.passwordReset,
      to: 'membre@example.com',
      locale: 'fr',
      data: {
        resetUrl: 'https://example.test/fr/password/reset/1?signature=abc',
        expiresInMinutes: 60,
      },
    } satisfies SendMailPayload

    await runJob(payload)

    fakeMailer.mails.assertSent(PasswordResetNotification, (sent) => {
      const fields = sent as unknown as Record<string, unknown>
      return (
        fields.email === 'membre@example.com' &&
        fields.resetUrl === payload.data.resetUrl &&
        fields.expiresInMinutes === 60
      )
    })
  })

  test("reconstruit le mail de vérification d'adresse depuis la charge", async () => {
    const payload = {
      idempotencyKey: 'test:emailVerification',
      kind: MAIL_KINDS.emailVerification,
      to: 'nouveau@example.com',
      locale: 'fr',
      data: {
        verifyUrl: 'https://example.test/fr/email/verify/1?signature=abc',
        expiresInHours: 24,
      },
    } satisfies SendMailPayload

    await runJob(payload)

    fakeMailer.mails.assertSent(EmailVerificationNotification, (sent) => {
      const fields = sent as unknown as Record<string, unknown>
      return (
        fields.email === 'nouveau@example.com' &&
        fields.verifyUrl === payload.data.verifyUrl &&
        fields.expiresInHours === 24
      )
    })
  })

  test('reconstruit la demande de contact de la landing depuis la charge', async ({ assert }) => {
    const payload = {
      idempotencyKey: 'test:contactRequest',
      kind: MAIL_KINDS.contactRequest,
      to: 'partners@promotional-sourcing.eu',
      locale: 'fr',
      data: {
        type: 'partnership',
        name: 'Léa Martin',
        company: 'Textiles SA',
        email: 'lea@textiles.example',
        phone: null,
        message: 'Bonjour',
        requesterLocale: 'de',
      },
    } satisfies SendMailPayload

    await runJob(payload)

    fakeMailer.mails.assertSent(ContactRequestNotification, ({ message }) => {
      assert.isTrue(message.hasTo('partners@promotional-sourcing.eu'))
      assert.isTrue(message.hasSubject('[Site] Demande de partenariat — Textiles SA'))
      return true
    })
  })

  test('une panne SMTP fait échouer le job pour que la queue le rejoue', async ({ assert }) => {
    fakeMailer.send = async () => {
      throw new Error('ECONNREFUSED 127.0.0.1:1025')
    }

    await assert.rejects(() => runJob(PAYLOAD, 2), 'ECONNREFUSED 127.0.0.1:1025')
  })

  test('une charge de type inconnu fait échouer le job explicitement', async ({ assert }) => {
    const corrupted = { ...PAYLOAD, kind: 'unknown-mail' } as unknown as SendMailPayload

    await assert.rejects(() => runJob(corrupted), 'Unknown transactional mail kind "unknown-mail"')
    fakeMailer.mails.assertNoneSent()
  })

  test('la politique de retry est déclarée sur le job', ({ assert }) => {
    assert.equal(SendMailJob.options.retry?.maxRetries, 5)
    assert.isFunction(SendMailJob.options.retry?.backoff)
  })

  test('failed() loggue sans relancer (dernière tentative épuisée)', async ({ assert }) => {
    const job = await jobFor(PAYLOAD, 6)
    await assert.doesNotReject(() => job.failed(new Error('ECONNREFUSED')))
  })

  test('deux exécutions de la même charge ne produisent qu’un seul envoi', async ({ assert }) => {
    await runJob(PAYLOAD)
    await runJob(PAYLOAD)

    assert.lengthOf(
      fakeMailer.mails.sent((m) => m instanceof OrganizationInvitationNotification),
      1
    )
    const row = await db
      .from('mail_deliveries')
      .where('idempotency_key', PAYLOAD.idempotencyKey)
      .first()
    assert.equal(row.status, 'sent')
    assert.isNotNull(row.sent_at)
    assert.isNull(row.payload)
    assert.equal(row.attempts, 1)
  })

  test('échec puis rejeu : un seul envoi effectif, et la ligne passe de failed à sent', async ({
    assert,
  }) => {
    const realSend = fakeMailer.send.bind(fakeMailer)
    let calls = 0
    fakeMailer.send = (async (...args: Parameters<typeof realSend>) => {
      calls += 1
      if (calls === 1) throw new Error('ECONNREFUSED')
      return realSend(...args)
    }) as typeof fakeMailer.send

    await assert.rejects(() => runJob(PAYLOAD, 1), 'ECONNREFUSED')
    const failedRow = await db
      .from('mail_deliveries')
      .where('idempotency_key', PAYLOAD.idempotencyKey)
      .first()
    assert.equal(failedRow.status, 'failed')
    assert.equal(failedRow.error, 'ECONNREFUSED')
    assert.isNotNull(failedRow.payload)

    await runJob(PAYLOAD, 2)
    await runJob(PAYLOAD, 3)

    assert.lengthOf(
      fakeMailer.mails.sent((m) => m instanceof OrganizationInvitationNotification),
      1
    )
    assert.equal(await new MailDeliveryService().statusOf(PAYLOAD.idempotencyKey), 'sent')
  })

  test('une erreur après la remise (marquage sent) ne fait ni échouer ni renvoyer le mail', async ({
    assert,
  }) => {
    const service = new MailDeliveryService()
    const originalMarkSent = service.markSent.bind(service)
    let marks = 0
    service.markSent = async (key: string) => {
      marks += 1
      if (marks === 1) throw new Error('db blip')
      return originalMarkSent(key)
    }
    app.container.swap(MailDeliveryService, () => service)

    try {
      await assert.doesNotReject(() => runJob(PAYLOAD))
      assert.lengthOf(
        fakeMailer.mails.sent((m) => m instanceof OrganizationInvitationNotification),
        1
      )
    } finally {
      app.container.restore(MailDeliveryService)
    }
  })

  test('failed() écrit la dead-letter et émet MailDeliveryFailed', async ({ assert }) => {
    const events = emitter.fake([MailDeliveryFailed])
    try {
      await assert.rejects(async () => {
        fakeMailer.send = async () => {
          throw new Error('ECONNREFUSED')
        }
        await runJob(PAYLOAD, 1)
      })
      await failJob(new Error('ECONNREFUSED'), PAYLOAD, 6)

      const row = await db
        .from('mail_deliveries')
        .where('idempotency_key', PAYLOAD.idempotencyKey)
        .first()
      assert.equal(row.status, 'failed')
      events.assertEmitted(MailDeliveryFailed, ({ data }) => {
        return (
          data.delivery.idempotencyKey === PAYLOAD.idempotencyKey && data.delivery.attempts === 1
        )
      })
    } finally {
      emitter.restore()
    }
  })

  test('une charge sans clé (mise en queue avant #59) est dédoublonnée par id de job', async ({
    assert,
  }) => {
    const legacy: Partial<SendMailPayload> = { ...PAYLOAD }
    delete legacy.idempotencyKey
    await runJob(legacy as unknown as SendMailPayload)
    await runJob(legacy as unknown as SendMailPayload)

    assert.lengthOf(
      fakeMailer.mails.sent((m) => m instanceof OrganizationInvitationNotification),
      1
    )
  })
})
