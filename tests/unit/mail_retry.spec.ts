import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import MailRetry from '../../commands/mail_retry.js'
import SendMailJob from '#jobs/send_mail_job'
import MailDeliveryService from '#services/mail_delivery_service'
import OrganizationInvitationNotification from '#mails/organization_invitation_notification'
import { useDatabase } from '#tests/utils/setup'
import { mailIdempotencyKey } from '#shared/helpers/mail'
import { MAIL_KINDS, type SendMailPayload } from '#shared/types/mail'

function payload(key: string): SendMailPayload {
  return {
    idempotencyKey: key,
    kind: MAIL_KINDS.organizationInvitation,
    to: 'invited@example.com',
    locale: 'fr',
    data: { organizationName: 'Acme', roleName: 'Membre', inviterName: 'Owner', acceptUrl: 'u' },
  }
}

function jobFor(content: SendMailPayload, attempt: number) {
  const job = new SendMailJob()
  job.$hydrate(content, {
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

test.group('mail:retry', (group) => {
  useDatabase(group, { seed: 'none' })

  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    ace.ui.switchMode('raw')
    return () => {
      mail.restore()
      ace.ui.switchMode('normal')
    }
  })

  const sentCount = () =>
    fakeMailer.mails.sent((sent) => sent instanceof OrganizationInvitationNotification).length

  test('mail en échec définitif : visible en failed, puis rejoué par mail:retry', async ({
    assert,
  }) => {
    const content = payload('organization-invitation:invitation=9:send=a')
    const real = fakeMailer.send.bind(fakeMailer)
    let down = true
    fakeMailer.send = (async (...args: Parameters<typeof real>) => {
      if (down) throw new Error('ECONNREFUSED')
      return real(...args)
    }) as typeof fakeMailer.send

    await assert.rejects(() => jobFor(content, 5).execute(), 'ECONNREFUSED')
    await jobFor(content, 6).failed(new Error('ECONNREFUSED'))

    const deliveries = new MailDeliveryService()
    assert.equal(await deliveries.statusOf(content.idempotencyKey), 'failed')
    assert.equal(sentCount(), 0)

    down = false
    const command = await ace.create(MailRetry, [content.idempotencyKey])
    await command.exec()

    assert.equal(command.exitCode, 0)
    assert.equal(sentCount(), 1)
    assert.equal(await deliveries.statusOf(content.idempotencyKey), 'sent')

    // Rejouer un mail déjà parti n'envoie rien de plus.
    const retryAll = await ace.create(MailRetry, ['--all-failed'])
    await retryAll.exec()
    await SendMailJob.dispatch(content)
    assert.equal(sentCount(), 1)
  })

  test('--all-failed rejoue toutes les lignes failed et seulement elles', async ({ assert }) => {
    const deliveries = new MailDeliveryService()
    const a = payload('k:a')
    const b = payload('k:b')
    const done = payload('k:done')
    for (const content of [a, b]) await deliveries.markFailed(content, new Error('boom'))
    await deliveries.begin(done)
    await deliveries.markSent(done.idempotencyKey)

    const retryAll = await ace.create(MailRetry, ['--all-failed'])
    await retryAll.exec()

    assert.equal(sentCount(), 2)
    const rows = await db.from('mail_deliveries').where('status', 'failed')
    assert.lengthOf(rows, 0)
  })

  test('refuse un appel sans clé ni --all-failed, ou avec les deux', async ({ assert }) => {
    const none = await ace.create(MailRetry, [])
    await none.exec()
    assert.equal(none.exitCode, 1)

    const both = await ace.create(MailRetry, ['k', '--all-failed'])
    await both.exec()
    assert.equal(both.exitCode, 1)
  })

  test('clé inconnue : sortie 1', async ({ assert }) => {
    const command = await ace.create(MailRetry, ['inconnue'])
    await command.exec()
    assert.equal(command.exitCode, 1)
  })
})

test.group('mailIdempotencyKey', () => {
  test('forme <kind>:<clé>=<valeur>, indépendante de l’ordre des parts', ({ assert }) => {
    const key = mailIdempotencyKey(MAIL_KINDS.rfqReceived, { rfq: 12, org: 7 })
    assert.equal(key, 'rfq-received:org=7:rfq=12')
    assert.equal(key, mailIdempotencyKey(MAIL_KINDS.rfqReceived, { org: 7, rfq: 12 }))
  })
})
