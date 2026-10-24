import { readFileSync } from 'node:fs'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import EmailVerificationNotification from '#mails/email_verification_notification'
import OrganizationInvitationNotification from '#mails/organization_invitation_notification'
import PasswordResetNotification from '#mails/password_reset_notification'
import RfqReceivedNotification from '#mails/rfq_received_notification'
import WelcomeNotification from '#mails/welcome_notification'
import { SUPPORTED_LOCALES, type Locale } from '#shared/types/i18n'
import type User from '#models/user'

/**
 * Rendu des mails dans la langue du destinataire (#58). Aucune base : on
 * construit la classe de mail et on rend son sujet et son HTML.
 */
async function render(mailer: {
  buildWithContents(): Promise<void>
  message: { toJSON(): { message: Record<string, any> } }
}) {
  await mailer.buildWithContents()
  const { message } = mailer.message.toJSON()
  return { subject: message.subject as string, html: message.html as string }
}

const mailers: Record<string, (locale: Locale) => Parameters<typeof render>[0]> = {
  invitation: (locale) =>
    new OrganizationInvitationNotification(
      'invited@example.com',
      'Acme',
      'Manager',
      'Alice',
      'https://example.test/accept',
      locale
    ) as never,
  rfqReceived: (locale) =>
    new RfqReceivedNotification(
      'supplier@example.com',
      'Acme',
      'Tote bags',
      3,
      '30/10/2026',
      '/x/supplier/rfqs/1',
      locale
    ) as never,
  passwordReset: (locale) =>
    new PasswordResetNotification(
      'member@example.com',
      'https://example.test/reset',
      60,
      locale
    ) as never,
  emailVerification: (locale) =>
    new EmailVerificationNotification(
      'new@example.com',
      'https://example.test/verify',
      24,
      locale
    ) as never,
  welcome: (locale) =>
    new WelcomeNotification({
      email: 'new@example.com',
      fullName: 'Nina',
      locale,
    } as unknown as User) as never,
}

test.group('Mails — rendu dans la langue du destinataire', () => {
  for (const [name, build] of Object.entries(mailers)) {
    test(`${name} : sujet et corps rendus dans chaque langue, sans clé brute`, async ({
      assert,
    }) => {
      const subjects = new Set<string>()

      for (const locale of SUPPORTED_LOCALES) {
        const { subject, html } = await render(build(locale))

        assert.isNotEmpty(subject, locale)
        assert.notInclude(subject, 'emails.', locale)
        assert.notInclude(html, 'emails.', locale)
        assert.notInclude(subject, '{', locale)
        assert.include(html, `<html lang="${locale}">`)
        subjects.add(subject)
      }

      // Chaque langue a son propre sujet.
      assert.equal(subjects.size, SUPPORTED_LOCALES.length)
    })
  }

  test('le même envoi donne un sujet français ou anglais selon le destinataire', async ({
    assert,
  }) => {
    const fr = await render(mailers.rfqReceived('fr'))
    const en = await render(mailers.rfqReceived('en'))

    assert.equal(fr.subject, 'Nouvelle demande de devis de Acme')
    assert.equal(en.subject, 'New request for quotation from Acme')
    assert.include(fr.html, 'Consulter la demande')
    assert.include(en.html, 'View the request')
    assert.include(en.html, '3 lines')
  })

  test('le pluriel suit les règles de la langue (polonais : one / few / many)', async ({
    assert,
  }) => {
    const { html } = await render(mailers.passwordReset('pl'))

    assert.include(html, '60 minut')
  })

  test('une valeur saisie par un utilisateur reste échappée', async ({ assert }) => {
    const mailer = new RfqReceivedNotification(
      'supplier@example.com',
      '<script>alert(1)</script>',
      'Tote',
      1,
      null,
      '/x',
      'en'
    )
    const { html } = await render(mailer as never)

    assert.notInclude(html, '<script>alert(1)</script>')
    assert.include(html, '&lt;script&gt;')
  })
})

test.group('Mails — fichiers de langue', () => {
  const load = (locale: string) =>
    JSON.parse(readFileSync(app.languageFilesPath(`${locale}/emails.json`), 'utf8'))

  const flatten = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([key, child]) =>
          flatten(child, prefix ? `${prefix}.${key}` : key)
        )
      : [prefix]

  test('emails.json existe pour chaque langue, avec les mêmes clés que le français', ({
    assert,
  }) => {
    const reference = flatten(load('fr')).sort()

    for (const locale of SUPPORTED_LOCALES) {
      assert.deepEqual(flatten(load(locale)).sort(), reference, locale)
    }
  })
})
